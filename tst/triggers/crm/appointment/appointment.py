import frappe
from frappe import _
from frappe.utils import nowdate, get_link_to_form
from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note


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
        tech_qty = get_stock_qty(item_code, technician_warehouse)
        allocated_qty = min(tech_qty, required_qty)
        remaining_needed = required_qty - allocated_qty

        # 2. Check assistant technicians' warehouses
        if remaining_needed > 0:
            for tech in installation_order.sub_installation_order_technician:
                if not tech.warehouse:
                    continue

                wh_qty = get_stock_qty(item_code, tech.warehouse)
                allocate = min(wh_qty, remaining_needed)
                if allocate > 0:
                    remaining_needed -= allocate

        # 3. Create MR for remaining quantity
        if remaining_needed > 0:
            source_warehouse = get_best_source_warehouse(
                item_code, technician_warehouse
            )

            if not source_warehouse:
                frappe.throw(_(f"No available stock found for {item_code}"))

            material_requests.setdefault(source_warehouse, []).append(
                {
                    "item_code": item_code,
                    "qty": remaining_needed,
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
    validate_item_serial_qty_to_so_qty(self)

    handle_attachments(self)
    if self.custom_appointment_status == "Done Installation":
        if not self.custom_choose_serial_and_batch_bundle:
            frappe.throw(_("Please add at least one Serial No or Batch Bundle."))
        create_device_setup(self)
        create_delivery_note(self)


def validate_item_serial_qty_to_so_qty(self):
    if not self.custom_sales_order:
        frappe.throw(_("Sales Order is required to validate serial numbers."))
    total_qty = frappe.db.get_value(
        "Sales Order",
        self.custom_sales_order,
        "total_qty",
    )
    if len(self.custom_choose_serial_and_batch_bundle) > total_qty:
        frappe.throw(
            _(
                "The number of Serial No  entries exceeds the total quantity in Sales Order."
            )
        )


def create_device_setup(self):
    for row in self.custom_choose_serial_and_batch_bundle:
        device_setup = frappe.new_doc("Device Setup")
        device_setup.status = "Done Installation Ready for Server Setup"
        device_setup.appointment = self.name
        if device_setup_name := frappe.db.get_value(
            "Device Setup",
            {
                # "appointment": self.name,
                "serial_no": row.serial_no,
                # "status": ["not in", ["Inactive", "Broken", "Archived", "Suspended"]],
                # "docstatus": 1,
            },
        ):
            frappe.msgprint(
                _(
                    f"There is a Device Setup Still Open {get_link_to_form('Device Setup', device_setup_name)} Serial NO: {row.serial_no}"
                )
            )
            continue
        device_setup.serial_no = row.serial_no
        device_setup.attachments = row.attachments
        device_setup.chassie_no = row.chassie_no
        device_setup.license_plate = row.license_plate
        device_setup.save()
    self.status = "Closed"
    frappe.msgprint(_("Sent to Server Setup Team"))


def handle_attachments(self):
    for row in self.custom_choose_serial_and_batch_bundle:
        validate_license_chassie_no(row)
        if row.attachment:
            # Add to existing attachments if any
            if row.attachments:
                row.attachments += "\n" + row.attachment
            else:
                row.attachments = row.attachment

            # Get the Serial No document
            serial_no_doc = frappe.get_doc("Serial No", row.serial_no)

            # Copy attachment to Serial No
            copy_attachment_to_serial_no(row.attachment, serial_no_doc)

            # Reset the attachment field
            row.attachment = None
            frappe.msgprint(_("File Attached Successfully"))


def validate_license_chassie_no(row):
    if not (row.license_plate or row.chassie_no):
        frappe.throw(
            _("Has to include license plate or chassie number")
            + f" row index {row.idx}"
        )


def copy_attachment_to_serial_no(attachment_url, serial_no_doc):
    """Copy attachment from current doc to Serial No document"""
    from frappe.utils.file_manager import save_file

    # Get the file data from the attachment
    file_name = attachment_url.split("/")[-1]
    file_data = frappe.get_doc("File", {"file_url": attachment_url})

    # Save the file to the Serial No document
    save_file(
        fname=file_name,
        content=file_data.get_content(),
        dt="Serial No",
        dn=serial_no_doc.name,
        folder="Home/Attachments",
        is_private=0,
    )

    # Commit to ensure the file is saved before proceeding
    frappe.db.commit()


@frappe.whitelist()
def on_submit(doc, method=None):
    pass


# def make_delivery_note(source_name, target_doc=None, kwargs=None):
def create_delivery_note(doc):
    """
    Create Delivery Note from Sales Order.

    :param source_name: Name of the Sales Order
    :param target_doc: Optional target document to modify
    :param kwargs: Additional arguments for customization
    :return: Name of the created Delivery Note
    """
    delivery_note = make_delivery_note(
        doc.custom_sales_order, target_doc=None, kwargs=None
    )
    if delivery_note:
        delivery_note.save()
        delivery_note.submit()
        frappe.msgprint(
            _("Delivery Note created successfully: {0}").format(
                get_link_to_form("Delivery Note", delivery_note.name)
            )
        )
        return delivery_note
    else:
        frappe.throw(_("Failed to create Delivery Note."))
