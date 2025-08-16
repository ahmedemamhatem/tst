import frappe
from frappe import _
from frappe.utils import nowdate, get_link_to_form

from frappe.utils import now

import json
from typing import Literal

import frappe
import frappe.utils
from frappe import _, qb
from frappe.contacts.doctype.address.address import get_company_address
from frappe.desk.notifications import clear_doctype_notifications
from frappe.model.mapper import get_mapped_doc
from frappe.model.utils import get_fetch_values
from frappe.query_builder.functions import Sum
from frappe.utils import (
    add_days,
    cint,
    cstr,
    flt,
    get_link_to_form,
    getdate,
    nowdate,
    strip_html,
)

from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
    unlink_inter_company_doc,
    update_linked_doc,
    validate_inter_company_party,
)
from erpnext.accounts.party import get_party_account
from erpnext.controllers.selling_controller import SellingController
from erpnext.manufacturing.doctype.blanket_order.blanket_order import (
    validate_against_blanket_order,
)
from erpnext.manufacturing.doctype.production_plan.production_plan import (
    get_items_for_material_requests,
)
from erpnext.selling.doctype.customer.customer import check_credit_limit
from erpnext.setup.doctype.item_group.item_group import get_item_group_defaults
from erpnext.stock.doctype.item.item import get_item_defaults
from erpnext.stock.doctype.stock_reservation_entry.stock_reservation_entry import (
    get_sre_reserved_qty_details_for_voucher,
    has_reserved_stock,
)
from erpnext.stock.get_item_details import (
    get_bin_details,
    get_default_bom,
    get_price_list_rate,
)
from erpnext.stock.stock_balance import get_reserved_qty, update_bin_qty
from frappe.model.mapper import get_mapped_doc


@frappe.whitelist()
def after_insert(doc, method=None):
    check_required_items(doc)


def check_required_items(doc):
    if doc.custom_is_sub_technician:
        return

    material_requests = {}
    installation_order = frappe.get_cached_doc(
        "Installation Order", doc.custom_installation_order
    )
    technician = frappe.get_cached_doc("Technician", doc.custom_technician)
    technician_warehouse = technician.warehouse

    for item in installation_order.items:
        item_code = item.get("item_code")
        required_qty = item.get("qty")

        # 1. Check technician's warehouse first
        # tech_qty = get_stock_qty(item_code, technician_warehouse)
        # allocated_qty = min(tech_qty, required_qty)
        # remaining_needed = required_qty - allocated_qty

        # # 2. Check assistant technicians' warehouses
        # if remaining_needed > 0:
        #     for tech in installation_order.sub_installation_order_technician:
        #         if not tech.warehouse:
        #             continue

        #         wh_qty = get_stock_qty(item_code, tech.warehouse)
        #         allocate = min(wh_qty, remaining_needed)
        #         if allocate > 0:
        #             remaining_needed -= allocate

        # 3. Create MR for remaining quantity
        if required_qty > 0:
            source_warehouse = get_best_source_warehouse(
                item_code, technician_warehouse
            )

            if not source_warehouse:
                frappe.throw(_(f"No available stock found for {item_code}"))

            material_requests.setdefault(source_warehouse, []).append(
                {
                    "item_code": item_code,
                    "qty": required_qty,
                    "schedule_date": nowdate(),
                    "from_warehouse": source_warehouse,
                    "warehouse": technician_warehouse,
                }
            )

    # Create material requests
    for source_wh, items in material_requests.items():
        create_material_request(
            items, technician_warehouse, source_wh, doc.custom_technician, doc.name
        )


def get_best_source_warehouse(item_code, exclude_warehouse):
    """Find the best warehouse to source items from"""
    warehouses = frappe.db.sql(
        """
        SELECT warehouse, actual_qty
        FROM `tabBin`
        JOIN `tabWarehouse` ON `tabBin`.warehouse = `tabWarehouse`.name
        WHERE item_code = %s
          AND warehouse != %s
          AND actual_qty > 0
            AND `tabWarehouse`.custom_warehouse_ownership = 'Fiscal Warehouse'
        ORDER BY actual_qty DESC
        LIMIT 1
    """,
        (item_code, exclude_warehouse),
        as_dict=1,
    )

    return warehouses[0].warehouse if warehouses else None


def get_default_warehouse(item_code):
    default_warehouse = frappe.get_cached_value(
        "Item Default", {"parent": item_code}, "default_warehouse"
    )

    return default_warehouse


def get_stock_qty(item_code, warehouse):
    """
    Returns the actual quantity of an item in a specific warehouse.

    :param item_code: Item code to check
    :param warehouse: Warehouse to check in
    :return: Actual quantity available (float)
    """
    return (
        frappe.db.get_value(
            "Bin", {"item_code": item_code, "warehouse": warehouse}, "actual_qty"
        )
        or 0
    )


def create_material_request(
    items, target_warehouse, source_warehouse, technician, reference_link
):
    mr = frappe.get_doc(
        {
            "doctype": "Material Request",
            "material_request_type": "Material Transfer",
            "custom_reference_doctype": "Appointment",
            "custom_reference_link": reference_link,
            "schedule_date": nowdate(),
            "set_from_warehouse": source_warehouse,
            "set_warehouse": target_warehouse,
            "items": items,
        }
    )

    mr.insert()
    if mr.name:
        warehouse_manager_user = frappe.get_cached_value(
            "Warehouse", {"name": target_warehouse}, "custom_warehouse_manager"
        )
        mobile_no = None

        if warehouse_manager_user:
            mobile_no = frappe.get_cached_value(
                "User", {"name": warehouse_manager_user}, "mobile_no"
            )

        recipient_persons = [
            {
                "receipent_person": "Technician",
                "mobile_no": frappe.get_cached_value(
                    "Technician", {"name": technician}, "whatsapp_number"
                ),
            },
            {"receipent_person": "Warehouse Manager", "mobile_no": mobile_no},
        ]

        create_whatsapp_message_for_material_request(
            mr.name, warehouse_manager_user, recipient_persons
        )

        return mr.name


def create_whatsapp_message_for_material_request(
    material_request_name, warehouse_manager_user, recipients
):
    """
    Create WhatsApp Message for each recipient (technician, warehouse manager).

    :param material_request_name: Name of the Material Request
    :param recipients: List of dicts with keys: receipent_person, mobile_no
    """
    material_request = frappe.get_cached_doc("Material Request", material_request_name)

    # Extract shared data
    order_number = material_request.name
    posting_date = material_request.transaction_date
    owner = warehouse_manager_user
    owner_contact = (
        frappe.get_cached_value("User", owner, "mobile_no") or "Not Provided"
    )
    warehouse = material_request.set_warehouse or "Not Specified"

    # Format items
    item_lines = []
    for item in material_request.items:
        line = f"{item.qty} - {item.item_name} - {item.description or ''}"
        item_lines.append(line)
    items_text = "\n".join(item_lines)

    for recipient in recipients:
        mobile_no = recipient.get("mobile_no")
        role = recipient.get("receipent_person")

        if not mobile_no:
            frappe.log_error(
                f"No mobile number for {role}", "WhatsApp Message Creation"
            )
            continue

        # Compose message
        message = f"""
                تم طلب الطلبية

                رقم الطلبية: {order_number}

                تاريخ الإنشاء: {posting_date}

                موقع التسليم: {warehouse}

                المسئول عن التسليم: {owner}

                هاتف للتواصل: {owner_contact}

                تفاصيل الطلبية:
                {items_text}

                حالة الطلبية: Draft
                """

        # Create WhatsApp Message
        whatsapp_doc = frappe.new_doc("WH Massage")
        whatsapp_doc.phone = mobile_no
        whatsapp_doc.send_message = message
        whatsapp_doc.insert(ignore_permissions=True)

    frappe.db.commit()


@frappe.whitelist()
def validate(self, method=None):
    self.calendar_event = ""

    if self.attachment:
        self.append("attachments",{
            "attachment":self.attachment,
            "attach_on": now()
        })
        # clear the single attachment field
        self.single_attachment = None



@frappe.whitelist()
def on_submit(doc, method=None):
    pass


# def make_delivery_note(source_name, target_doc=None, kwargs=None):
def create_delivery_note(device_setup):
    """
    Create Delivery Notes from Device Setup.
    One DN for the device serial_no, and another DN for parent_item if exists.
    """

    def make_dn(item_code, serial_no, warehouse, sales_order, device_setup, label):
        # Create base DN
        dn = frappe.new_doc("Delivery Note")
        so = frappe.get_doc("Sales Order", sales_order)
        dn.customer = so.customer
        dn.posting_date = frappe.utils.nowdate()
        dn.posting_time = frappe.utils.nowtime()
        dn.custom_device_setup = device_setup.name
        dn.custom_appointment = device_setup.appointment

        # Add item row with Serial and Batch Bundle
        item_row = {
            "item_code": item_code,
            "qty": 1,
            "warehouse": warehouse,
            "use_serial_batch_fields": 1,
        }

        # Create bundle
        serial_and_batch_bundle = frappe.new_doc("Serial and Batch Bundle")
        serial_and_batch_bundle.update(
            {
                "item_code": item_code,
                "type_of_transaction": "Outward",
                "warehouse": warehouse,
                "has_serial_no": 1,
                "has_batch_no": 0,
                "voucher_type": "Delivery Note",
                "voucher_no": dn.name,
            }
        )
        serial_and_batch_bundle.append(
            "entries",
            {
                "serial_no": serial_no,
                "qty": -1,
                "warehouse": warehouse,
            },
        )
        serial_and_batch_bundle.save()

        item_row["serial_and_batch_bundle"] = serial_and_batch_bundle.name
        dn.append("items", item_row)

        # Save + Submit
        dn.save()
        dn.submit()

        frappe.msgprint(
            _(f"{label} Delivery Note created successfully: {get_link_to_form('Delivery Note', dn.name)}")
        )
        return dn

    # --- DN for device serial
    device_dn = make_dn(
        device_setup.item_code,
        device_setup.serial_no,
        device_setup.warehouse,
        device_setup.sales_order,
        device_setup,
        "Device",
    )

    # --- DN for parent_item (if exists, e.g. SIM)
    parent_dn = None
    if getattr(device_setup, "parent_item", None):
        parent_item_code = frappe.db.get_value("Serial No", device_setup.parent_item, "item_code")
        if parent_item_code:
            parent_dn = make_dn(
                parent_item_code,
                device_setup.parent_item,
                device_setup.warehouse,
                device_setup.sales_order,
                device_setup,
                "Parent Item",
            )

    return {"device_dn": device_dn.name, "parent_dn": parent_dn.name if parent_dn else None}


@frappe.whitelist()
def make_delivery_note(source_name, appointment, target_doc=None, kwargs=None):
    from erpnext.stock.doctype.packed_item.packed_item import make_packing_list
    from erpnext.stock.doctype.stock_reservation_entry.stock_reservation_entry import (
        get_sre_details_for_voucher,
        get_sre_reserved_qty_details_for_voucher,
    )

    if not kwargs:
        kwargs = {
            "for_reserved_stock": frappe.flags.args
            and frappe.flags.args.for_reserved_stock,
            "skip_item_mapping": frappe.flags.args
            and frappe.flags.args.skip_item_mapping,
        }

    kwargs = frappe._dict(kwargs)

    sre_details = {}
    if kwargs.for_reserved_stock:
        sre_details = get_sre_reserved_qty_details_for_voucher(
            "Sales Order", source_name
        )

    mapper = {
        "Sales Order": {
            "doctype": "Delivery Note",
            "validation": {"docstatus": ["=", 1]},
        },
        "Sales Taxes and Charges": {
            "doctype": "Sales Taxes and Charges",
            "reset_value": True,
        },
        "Sales Team": {"doctype": "Sales Team", "add_if_empty": True},
    }

    # 0 qty is accepted, as the qty is uncertain for some items
    has_unit_price_items = frappe.db.get_value(
        "Sales Order", source_name, "has_unit_price_items"
    )

    def is_unit_price_row(source):
        return has_unit_price_items and source.qty == 0

    def set_missing_values(source, target, appointment):
        if kwargs.get("ignore_pricing_rule"):
            # Skip pricing rule when the dn is creating from the pick list
            target.ignore_pricing_rule = 1

        target.run_method("set_missing_values")
        target.run_method("set_po_nos")
        target.run_method("calculate_taxes_and_totals")

        if source.company_address:
            target.update({"company_address": source.company_address})
        else:
            # set company address
            target.update(get_company_address(target.company))

        if target.company_address:
            target.update(
                get_fetch_values(
                    "Delivery Note", "company_address", target.company_address
                )
            )

        # if invoked in bulk creation, validations are ignored and thus this method is nerver invoked
        if frappe.flags.bulk_transaction:
            # set target items names to ensure proper linking with packed_items
            target.set_new_name()

        make_packing_list(target)

    def condition(doc):
        if doc.name in sre_details:
            del sre_details[doc.name]
            return False

        # make_mapped_doc sets js `args` into `frappe.flags.args`
        if frappe.flags.args and frappe.flags.args.delivery_dates:
            if cstr(doc.delivery_date) not in frappe.flags.args.delivery_dates:
                return False

        return (
            (abs(doc.delivered_qty) < abs(doc.qty)) or is_unit_price_row(doc)
        ) and doc.delivered_by_supplier != 1

    def update_item(source, target, source_parent):
        target.base_amount = (flt(source.qty) - flt(source.delivered_qty)) * flt(
            source.base_rate
        )
        target.amount = (flt(source.qty) - flt(source.delivered_qty)) * flt(source.rate)
        target.qty = (
            flt(source.qty)
            if is_unit_price_row(source)
            else flt(source.qty) - flt(source.delivered_qty)
        )

        item = get_item_defaults(target.item_code, source_parent.company)
        item_group = get_item_group_defaults(target.item_code, source_parent.company)
        # item serial bundle
        sb_entries = {}
        for row in appointment.custom_choose_serial_and_batch_bundle:
            if sb_entries.get(target.item_code):
                sb_entries[target.item_code].append(row)

        if sb_entries:
            bundle = frappe.new_doc("Serial and Batch Bundle")
            bundle.type_of_transaction = "Outward"
            bundle.voucher_type = "Delivery Note"
            bundle.posting_date = nowdate()
            bundle.posting_time = frappe.utils.nowtime()
            bundle.item_code = target.item_code
            bundle.warehouse = target.warehouse
            bundle.has_serial_no = 1
            bundle.has_batch_no = 0

            for item_code in sb_entries:
                for row in sb_entries[item_code]:
                    bundle.append(
                        "entries",
                        {
                            "serial_no": row.serial_no,
                            "warehouse": row.warehouse,
                            "qty": -1,
                        },
                    )

            bundle.save()
            item.serial_and_batch_bundle = bundle.name
            item.use_serial_batch_fields = 1

        if item:
            target.cost_center = (
                frappe.db.get_value("Project", source_parent.project, "cost_center")
                or item.get("buying_cost_center")
                or item_group.get("buying_cost_center")
            )

    if not kwargs.skip_item_mapping:
        mapper["Sales Order Item"] = {
            "doctype": "Delivery Note Item",
            "field_map": {
                "rate": "rate",
                "name": "so_detail",
                "parent": "against_sales_order",
            },
            "condition": condition,
            "postprocess": update_item,
        }

    so = frappe.get_doc("Sales Order", source_name)
    target_doc = get_mapped_doc("Sales Order", so.name, mapper, target_doc)

    # Should be called after mapping items.
    set_missing_values(so, target_doc, appointment)

    return target_doc


@frappe.whitelist()
def make_sales_invoice(source_name, target_doc=None, ignore_permissions=False):
    # 0 qty is accepted, as the qty is uncertain for some items
    has_unit_price_items = frappe.db.get_value(
        "Sales Order", source_name, "has_unit_price_items"
    )

    def is_unit_price_row(source):
        return has_unit_price_items and source.qty == 0

    def postprocess(source, target):
        set_missing_values(source, target)
        # Get the advance paid Journal Entries in Sales Invoice Advance
        if target.get("allocate_advances_automatically"):
            target.set_advances()

    def set_missing_values(source, target):
        target.flags.ignore_permissions = True
        target.run_method("set_missing_values")
        target.run_method("set_po_nos")
        target.run_method("calculate_taxes_and_totals")

        if source.company_address:
            target.update({"company_address": source.company_address})
        else:
            # set company address
            target.update(get_company_address(target.company))

        if target.company_address:
            target.update(
                get_fetch_values(
                    "Sales Invoice", "company_address", target.company_address
                )
            )

        # set the redeem loyalty points if provided via shopping cart
        if source.loyalty_points and source.order_type == "Shopping Cart":
            target.redeem_loyalty_points = 1

        target.debit_to = get_party_account("Customer", source.customer, source.company)

    def update_item(source, target, source_parent):
        if source_parent.has_unit_price_items:
            # 0 Amount rows (as seen in Unit Price Items) should be mapped as it is
            pending_amount = flt(source.amount) - flt(source.billed_amt)
            target.amount = pending_amount if flt(source.amount) else 0
        else:
            target.amount = flt(source.amount) - flt(source.billed_amt)

        target.base_amount = target.amount * flt(source_parent.conversion_rate)
        target.qty = (
            target.amount / flt(source.rate)
            if (source.rate and source.billed_amt)
            else (
                source.qty
                if is_unit_price_row(source)
                else source.qty - source.returned_qty
            )
        )

        if source_parent.project:
            target.cost_center = frappe.db.get_value(
                "Project", source_parent.project, "cost_center"
            )
        if target.item_code:
            item = get_item_defaults(target.item_code, source_parent.company)
            item_group = get_item_group_defaults(
                target.item_code, source_parent.company
            )
            cost_center = item.get("selling_cost_center") or item_group.get(
                "selling_cost_center"
            )

            if cost_center:
                target.cost_center = cost_center

    doclist = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Sales Invoice",
                "field_map": {
                    "party_account_currency": "party_account_currency",
                    "payment_terms_template": "payment_terms_template",
                },
                "field_no_map": ["payment_terms_template"],
                "validation": {"docstatus": ["=", 1]},
            },
            "Sales Order Item": {
                "doctype": "Sales Invoice Item",
                "field_map": {
                    "name": "so_detail",
                    "parent": "sales_order",
                },
                "postprocess": update_item,
                "condition": lambda doc: (
                    True
                    if is_unit_price_row(doc)
                    else (
                        doc.qty
                        and (
                            doc.base_amount == 0
                            or abs(doc.billed_amt) < abs(doc.amount)
                        )
                    )
                ),
            },
            "Sales Taxes and Charges": {
                "doctype": "Sales Taxes and Charges",
                "reset_value": True,
            },
            "Sales Team": {"doctype": "Sales Team", "add_if_empty": True},
        },
        target_doc,
        postprocess,
        ignore_permissions=ignore_permissions,
    )

    automatically_fetch_payment_terms = cint(
        frappe.db.get_single_value(
            "Accounts Settings", "automatically_fetch_payment_terms"
        )
    )
    if automatically_fetch_payment_terms:
        doclist.set_payment_schedule()

    return doclist


@frappe.whitelist()
def make_maintenance_schedule(source_name, target_doc=None):
    maint_schedule = frappe.db.sql(
        """select t1.name
		from `tabMaintenance Schedule` t1, `tabMaintenance Schedule Item` t2
		where t2.parent=t1.name and t2.sales_order=%s and t1.docstatus=1""",
        source_name,
    )

    if not maint_schedule:
        doclist = get_mapped_doc(
            "Sales Order",
            source_name,
            {
                "Sales Order": {
                    "doctype": "Maintenance Schedule",
                    "validation": {"docstatus": ["=", 1]},
                },
                "Sales Order Item": {
                    "doctype": "Maintenance Schedule Item",
                    "field_map": {"parent": "sales_order"},
                },
            },
            target_doc,
        )

        return doclist


@frappe.whitelist()
def make_maintenance_visit(source_name, target_doc=None):
    visit = frappe.db.sql(
        """select t1.name
		from `tabMaintenance Visit` t1, `tabMaintenance Visit Purpose` t2
		where t2.parent=t1.name and t2.prevdoc_docname=%s
		and t1.docstatus=1 and t1.completion_status='Fully Completed'""",
        source_name,
    )

    if not visit:
        doclist = get_mapped_doc(
            "Sales Order",
            source_name,
            {
                "Sales Order": {
                    "doctype": "Maintenance Visit",
                    "validation": {"docstatus": ["=", 1]},
                },
                "Sales Order Item": {
                    "doctype": "Maintenance Visit Purpose",
                    "field_map": {
                        "parent": "prevdoc_docname",
                        "parenttype": "prevdoc_doctype",
                    },
                },
            },
            target_doc,
        )

        return doclist


@frappe.whitelist()
def get_events(start, end, filters=None):
    """Returns events for Gantt / Calendar view rendering.

    :param start: Start date-time.
    :param end: End date-time.
    :param filters: Filters (JSON).
    """
    from frappe.desk.calendar import get_event_conditions

    conditions = get_event_conditions("Sales Order", filters)

    data = frappe.db.sql(
        f"""
		select
			distinct `tabSales Order`.name, `tabSales Order`.customer_name, `tabSales Order`.status,
			`tabSales Order`.delivery_status, `tabSales Order`.billing_status,
			`tabSales Order Item`.delivery_date
		from
			`tabSales Order`, `tabSales Order Item`
		where `tabSales Order`.name = `tabSales Order Item`.parent
			and `tabSales Order`.skip_delivery_note = 0
			and (ifnull(`tabSales Order Item`.delivery_date, '0000-00-00')!= '0000-00-00') \
			and (`tabSales Order Item`.delivery_date between %(start)s and %(end)s)
			and `tabSales Order`.docstatus < 2
			{conditions}
		""",
        {"start": start, "end": end},
        as_dict=True,
        update={
            "allDay": 0,
            "convertToUserTz": 0,
        },
    )
    return data


@frappe.whitelist()
def make_purchase_order_for_default_supplier(
    source_name, selected_items=None, target_doc=None
):
    """Creates Purchase Order for each Supplier. Returns a list of doc objects."""

    from erpnext.setup.utils import get_exchange_rate

    if not selected_items:
        return

    if isinstance(selected_items, str):
        selected_items = json.loads(selected_items)

    def set_missing_values(source, target):
        target.supplier = supplier
        target.currency = frappe.db.get_value(
            "Supplier", filters={"name": supplier}, fieldname=["default_currency"]
        )
        company_currency = frappe.db.get_value(
            "Company", filters={"name": target.company}, fieldname=["default_currency"]
        )

        target.conversion_rate = get_exchange_rate(
            target.currency, company_currency, args="for_buying"
        )

        target.apply_discount_on = ""
        target.additional_discount_percentage = 0.0
        target.discount_amount = 0.0
        target.inter_company_order_reference = ""
        target.shipping_rule = ""
        target.tc_name = ""
        target.terms = ""
        target.payment_terms_template = ""
        target.payment_schedule = []

        default_price_list = frappe.get_value(
            "Supplier", supplier, "default_price_list"
        )
        if default_price_list:
            target.buying_price_list = default_price_list

        default_payment_terms = frappe.get_value("Supplier", supplier, "payment_terms")
        if default_payment_terms:
            target.payment_terms_template = default_payment_terms

        if any(item.delivered_by_supplier == 1 for item in source.items):
            if source.shipping_address_name:
                target.shipping_address = source.shipping_address_name
                target.shipping_address_display = source.shipping_address
            else:
                target.shipping_address = source.customer_address
                target.shipping_address_display = source.address_display

            target.customer_contact_person = source.contact_person
            target.customer_contact_display = source.contact_display
            target.customer_contact_mobile = source.contact_mobile
            target.customer_contact_email = source.contact_email

        else:
            target.customer = ""
            target.customer_name = ""

        target.run_method("set_missing_values")
        target.run_method("calculate_taxes_and_totals")

    def update_item(source, target, source_parent):
        target.schedule_date = source.delivery_date
        target.qty = flt(source.qty) - (
            flt(source.ordered_qty) / flt(source.conversion_factor)
        )
        target.stock_qty = flt(source.stock_qty) - flt(source.ordered_qty)
        target.project = source_parent.project

    suppliers = [
        item.get("supplier") for item in selected_items if item.get("supplier")
    ]
    suppliers = list(
        dict.fromkeys(suppliers)
    )  # remove duplicates while preserving order

    items_to_map = [
        item.get("item_code") for item in selected_items if item.get("item_code")
    ]
    items_to_map = list(set(items_to_map))

    if not suppliers:
        frappe.throw(
            _(
                "Please set a Supplier against the Items to be considered in the Purchase Order."
            )
        )

    purchase_orders = []
    for supplier in suppliers:
        doc = get_mapped_doc(
            "Sales Order",
            source_name,
            {
                "Sales Order": {
                    "doctype": "Purchase Order",
                    "field_map": {"dispatch_address_name": "dispatch_address"},
                    "field_no_map": [
                        "address_display",
                        "contact_display",
                        "contact_mobile",
                        "contact_email",
                        "contact_person",
                        "taxes_and_charges",
                        "shipping_address",
                    ],
                    "validation": {"docstatus": ["=", 1]},
                },
                "Sales Order Item": {
                    "doctype": "Purchase Order Item",
                    "field_map": [
                        ["name", "sales_order_item"],
                        ["parent", "sales_order"],
                        ["stock_uom", "stock_uom"],
                        ["uom", "uom"],
                        ["conversion_factor", "conversion_factor"],
                        ["delivery_date", "schedule_date"],
                    ],
                    "field_no_map": [
                        "rate",
                        "price_list_rate",
                        "item_tax_template",
                        "discount_percentage",
                        "discount_amount",
                        "pricing_rules",
                        "margin_type",
                        "margin_rate_or_amount",
                    ],
                    "postprocess": update_item,
                    "condition": lambda doc: doc.ordered_qty < doc.stock_qty
                    and doc.supplier == supplier
                    and doc.item_code in items_to_map
                    and doc.delivered_by_supplier == 1,
                },
            },
            target_doc,
            set_missing_values,
        )

        doc.insert()
        frappe.db.commit()
        purchase_orders.append(doc)

    return purchase_orders


@frappe.whitelist()
def make_purchase_order(source_name, selected_items=None, target_doc=None):
    if not selected_items:
        return

    if isinstance(selected_items, str):
        selected_items = json.loads(selected_items)

    items_to_map = [
        item.get("item_code")
        for item in selected_items
        if item.get("item_code") and item.get("item_code")
    ]
    items_to_map = list(set(items_to_map))

    def is_drop_ship_order(target):
        drop_ship = True
        for item in target.items:
            if not item.delivered_by_supplier:
                drop_ship = False
                break

        return drop_ship

    def set_missing_values(source, target):
        target.supplier = ""
        target.apply_discount_on = ""
        target.additional_discount_percentage = 0.0
        target.discount_amount = 0.0
        target.inter_company_order_reference = ""
        target.shipping_rule = ""
        target.tc_name = ""
        target.terms = ""
        target.payment_terms_template = ""
        target.payment_schedule = []

        if is_drop_ship_order(target):
            if source.shipping_address_name:
                target.shipping_address = source.shipping_address_name
                target.shipping_address_display = source.shipping_address
            else:
                target.shipping_address = source.customer_address
                target.shipping_address_display = source.address_display

            target.customer_contact_person = source.contact_person
            target.customer_contact_display = source.contact_display
            target.customer_contact_mobile = source.contact_mobile
            target.customer_contact_email = source.contact_email
        else:
            target.customer = target.customer_name = target.shipping_address = None

        target.run_method("set_missing_values")
        if not target.taxes:
            target.append_taxes_from_item_tax_template()
        target.run_method("calculate_taxes_and_totals")

    def update_item(source, target, source_parent):
        target.schedule_date = source.delivery_date
        target.qty = flt(source.qty) - (
            flt(source.ordered_qty) / flt(source.conversion_factor)
        )
        target.stock_qty = flt(source.stock_qty) - flt(source.ordered_qty)
        target.project = source_parent.project

    def update_item_for_packed_item(source, target, source_parent):
        target.qty = flt(source.qty) - flt(source.ordered_qty)

    # po = frappe.get_list("Purchase Order", filters={"sales_order":source_name, "supplier":supplier, "docstatus": ("<", "2")})
    doc = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Purchase Order",
                "field_map": {"dispatch_address_name": "dispatch_address"},
                "field_no_map": [
                    "address_display",
                    "contact_display",
                    "contact_mobile",
                    "contact_email",
                    "contact_person",
                    "taxes_and_charges",
                    "shipping_address",
                ],
                "validation": {"docstatus": ["=", 1]},
            },
            "Sales Order Item": {
                "doctype": "Purchase Order Item",
                "field_map": [
                    ["name", "sales_order_item"],
                    ["parent", "sales_order"],
                    ["stock_uom", "stock_uom"],
                    ["uom", "uom"],
                    ["conversion_factor", "conversion_factor"],
                    ["delivery_date", "schedule_date"],
                ],
                "field_no_map": [
                    "rate",
                    "price_list_rate",
                    "item_tax_template",
                    "discount_percentage",
                    "discount_amount",
                    "supplier",
                    "pricing_rules",
                ],
                "postprocess": update_item,
                "condition": lambda doc: doc.ordered_qty < doc.stock_qty
                and doc.item_code in items_to_map
                and not is_product_bundle(doc.item_code),
            },
            "Packed Item": {
                "doctype": "Purchase Order Item",
                "field_map": [
                    ["name", "sales_order_packed_item"],
                    ["parent", "sales_order"],
                    ["uom", "uom"],
                    ["conversion_factor", "conversion_factor"],
                    ["parent_item", "product_bundle"],
                    ["rate", "rate"],
                ],
                "field_no_map": [
                    "price_list_rate",
                    "item_tax_template",
                    "discount_percentage",
                    "discount_amount",
                    "supplier",
                    "pricing_rules",
                ],
                "postprocess": update_item_for_packed_item,
                "condition": lambda doc: doc.parent_item in items_to_map,
            },
        },
        target_doc,
        set_missing_values,
    )

    set_delivery_date(doc.items, source_name)
    doc.set_onload("load_after_mapping", False)

    return doc


def set_delivery_date(items, sales_order):
    delivery_dates = frappe.get_all(
        "Sales Order Item",
        filters={"parent": sales_order},
        fields=["delivery_date", "item_code"],
    )

    delivery_by_item = frappe._dict()
    for date in delivery_dates:
        delivery_by_item[date.item_code] = date.delivery_date

    for item in items:
        if item.product_bundle:
            item.schedule_date = delivery_by_item[item.product_bundle]


def is_product_bundle(item_code):
    return frappe.db.exists("Product Bundle", {"name": item_code, "disabled": 0})


@frappe.whitelist()
def make_work_orders(items, sales_order, company, project=None):
    """Make Work Orders against the given Sales Order for the given `items`"""
    items = json.loads(items).get("items")
    out = []

    for i in items:
        if not i.get("bom"):
            frappe.throw(
                _("Please select BOM against item {0}").format(i.get("item_code"))
            )
        if not i.get("pending_qty"):
            frappe.throw(
                _("Please select Qty against item {0}").format(i.get("item_code"))
            )

        work_order = frappe.get_doc(
            dict(
                doctype="Work Order",
                production_item=i["item_code"],
                bom_no=i.get("bom"),
                qty=i["pending_qty"],
                company=company,
                sales_order=sales_order,
                sales_order_item=i["sales_order_item"],
                project=project,
                fg_warehouse=i["warehouse"],
                description=i["description"],
            )
        ).insert()
        work_order.set_work_order_operations()
        work_order.flags.ignore_mandatory = True
        work_order.save()
        out.append(work_order)

    return [p.name for p in out]


@frappe.whitelist()
def update_status(status, name):
    so = frappe.get_doc("Sales Order", name)
    so.update_status(status)


@frappe.whitelist()
def make_raw_material_request(items, company, sales_order, project=None):
    if not frappe.has_permission("Sales Order", "write"):
        frappe.throw(_("Not permitted"), frappe.PermissionError)

    if isinstance(items, str):
        items = frappe._dict(json.loads(items))

    for item in items.get("items"):
        item["include_exploded_items"] = items.get("include_exploded_items")
        item["ignore_existing_ordered_qty"] = items.get("ignore_existing_ordered_qty")
        item["include_raw_materials_from_sales_order"] = items.get(
            "include_raw_materials_from_sales_order"
        )

    items.update({"company": company, "sales_order": sales_order})

    item_wh = {}
    for item in items.get("items"):
        if item.get("warehouse"):
            item_wh[item.get("item_code")] = item.get("warehouse")

    raw_materials = get_items_for_material_requests(items)
    if not raw_materials:
        frappe.msgprint(
            _(
                "Material Request not created, as quantity for Raw Materials already available."
            )
        )
        return

    material_request = frappe.new_doc("Material Request")
    material_request.update(
        dict(
            doctype="Material Request",
            transaction_date=nowdate(),
            company=company,
            material_request_type="Purchase",
        )
    )
    for item in raw_materials:
        item_doc = frappe.get_cached_doc("Item", item.get("item_code"))

        schedule_date = add_days(nowdate(), cint(item_doc.lead_time_days))
        row = material_request.append(
            "items",
            {
                "item_code": item.get("item_code"),
                "qty": item.get("quantity"),
                "schedule_date": schedule_date,
                "warehouse": item_wh.get(item.get("main_bom_item"))
                or item.get("warehouse"),
                "sales_order": sales_order,
                "project": project,
            },
        )

        if not (
            strip_html(item.get("description")) and strip_html(item_doc.description)
        ):
            row.description = item_doc.item_name or item.get("item_code")

    material_request.insert()
    material_request.flags.ignore_permissions = 1
    material_request.run_method("set_missing_values")
    material_request.submit()
    return material_request


@frappe.whitelist()
def make_inter_company_purchase_order(source_name, target_doc=None):
    from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
        make_inter_company_transaction,
    )

    return make_inter_company_transaction("Sales Order", source_name, target_doc)


@frappe.whitelist()
def create_pick_list(source_name, target_doc=None):
    from erpnext.stock.doctype.packed_item.packed_item import is_product_bundle

    def validate_sales_order():
        so = frappe.get_doc("Sales Order", source_name)
        for item in so.items:
            if item.stock_reserved_qty > 0:
                frappe.throw(
                    _(
                        "Cannot create a pick list for Sales Order {0} because it has reserved stock. Please unreserve the stock in order to create a pick list."
                    ).format(frappe.bold(source_name))
                )

    def update_item_quantity(source, target, source_parent) -> None:
        picked_qty = flt(source.picked_qty) / (flt(source.conversion_factor) or 1)
        qty_to_be_picked = flt(source.qty) - max(picked_qty, flt(source.delivered_qty))

        target.qty = qty_to_be_picked
        target.stock_qty = qty_to_be_picked * flt(source.conversion_factor)

    def update_packed_item_qty(source, target, source_parent) -> None:
        qty = flt(source.qty)
        for item in source_parent.items:
            if source.parent_detail_docname == item.name:
                picked_qty = flt(item.picked_qty) / (flt(item.conversion_factor) or 1)
                pending_percent = (
                    item.qty - max(picked_qty, item.delivered_qty)
                ) / item.qty
                target.qty = target.stock_qty = qty * pending_percent
                return

    def should_pick_order_item(item) -> bool:
        return (
            abs(item.delivered_qty) < abs(item.qty)
            and item.delivered_by_supplier != 1
            and not is_product_bundle(item.item_code)
        )

    # Don't allow a Pick List to be created against a Sales Order that has reserved stock.
    validate_sales_order()

    doc = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Pick List",
                "field_map": {"set_warehouse": "parent_warehouse"},
                "validation": {"docstatus": ["=", 1]},
            },
            "Sales Order Item": {
                "doctype": "Pick List Item",
                "field_map": {"parent": "sales_order", "name": "sales_order_item"},
                "postprocess": update_item_quantity,
                "condition": should_pick_order_item,
            },
            "Packed Item": {
                "doctype": "Pick List Item",
                "field_map": {
                    "parent": "sales_order",
                    "name": "sales_order_item",
                    "parent_detail_docname": "product_bundle_item",
                },
                "field_no_map": ["picked_qty"],
                "postprocess": update_packed_item_qty,
            },
        },
        target_doc,
    )

    doc.purpose = "Delivery"

    doc.set_item_locations()

    return doc


def update_produced_qty_in_so_item(sales_order, sales_order_item):
    # for multiple work orders against same sales order item
    linked_wo_with_so_item = frappe.db.get_all(
        "Work Order",
        ["produced_qty"],
        {
            "sales_order_item": sales_order_item,
            "sales_order": sales_order,
            "docstatus": 1,
        },
    )

    total_produced_qty = 0
    for wo in linked_wo_with_so_item:
        total_produced_qty += flt(wo.get("produced_qty"))

    if not total_produced_qty and frappe.flags.in_patch:
        return

    frappe.db.set_value(
        "Sales Order Item", sales_order_item, "produced_qty", total_produced_qty
    )


@frappe.whitelist()
def get_work_order_items(sales_order, for_raw_material_request=0):
    """Returns items with BOM that already do not have a linked work order"""
    if sales_order:
        so = frappe.get_doc("Sales Order", sales_order)

        wo = qb.DocType("Work Order")

        items = []
        item_codes = [i.item_code for i in so.items]
        product_bundle_parents = [
            pb.new_item_code
            for pb in frappe.get_all(
                "Product Bundle",
                {"new_item_code": ["in", item_codes], "disabled": 0},
                ["new_item_code"],
            )
        ]

        for table in [so.items, so.packed_items]:
            for i in table:
                bom = get_default_bom(i.item_code)
                stock_qty = i.qty if i.doctype == "Packed Item" else i.stock_qty

                if not for_raw_material_request:
                    total_work_order_qty = flt(
                        qb.from_(wo)
                        .select(Sum(wo.qty))
                        .where(
                            (wo.production_item == i.item_code)
                            & (wo.sales_order == so.name)
                            & (wo.sales_order_item == i.name)
                            & (wo.docstatus.lt(2))
                        )
                        .run()[0][0]
                    )
                    pending_qty = stock_qty - total_work_order_qty
                else:
                    pending_qty = stock_qty

                if pending_qty and i.item_code not in product_bundle_parents:
                    items.append(
                        dict(
                            name=i.name,
                            item_code=i.item_code,
                            description=i.description,
                            bom=bom or "",
                            warehouse=i.warehouse,
                            pending_qty=pending_qty,
                            required_qty=pending_qty if for_raw_material_request else 0,
                            sales_order_item=i.name,
                        )
                    )

        return items


@frappe.whitelist()
def get_stock_reservation_status():
    return frappe.db.get_single_value("Stock Settings", "enable_stock_reservation")


@frappe.whitelist()
def make_vehicle_appointment(source_name, target_doc=None):
    doc = get_mapped_doc(
        "Appointment",
        source_name,
        {
            "Appointment": {
                "doctype": "Vehicle Appointment",
                "field_map": {
                    "name": "appointment",
                    "custom_installation_order": "installation_order",
                    "custom_technician_warehouse": "warehouse",
                    "custom_sales_order": "sales_order",
                },
            }
        },
    )
    return doc
