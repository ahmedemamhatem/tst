import frappe
from frappe.model.mapper import get_mapped_doc
from frappe import _


@frappe.whitelist()
def before_validate(doc, method=None):
    set_contract_type(doc)


@frappe.whitelist()
def make_training(sales_order_name):
    """
    Create Training documents for all Device Setups linked to this Sales Order
    Returns the last created Training name for routing
    """
    if not sales_order_name:
        frappe.throw(_("Sales Order name is required"))

    # Get all submitted Device Setups for this Sales Order
    device_setups = frappe.get_all(
        "Device Setup",
        filters={"sales_order": sales_order_name, "docstatus": 1},
        fields=["name", "serial_no"],
    )

    if not device_setups:
        frappe.throw(_("No submitted Device Setups found for this Sales Order"))

    last_training = None

    for device in device_setups:
        # Check if Training already exists
        # if not frappe.db.exists("Training", {"device": device.name}):
        training = frappe.new_doc("Training")
        training.update(
            {
                "device": device.name,
                "serial_no": device.serial_no,  # Include serial no if needed
                "sales_order": sales_order_name,
                "account_setup_verified": 1,
                "posting_date": frappe.utils.nowdate(),
            }
        )
        training.insert(ignore_permissions=True)
        last_training = training.name

    if not last_training:
        frappe.msgprint(_("Trainings already exist for all Device Setups"))
        return None

    return last_training


@frappe.whitelist()
def make_installation_order(source_name, target_doc=None):
    args = frappe.form_dict.get("args")
    if isinstance(args, str):
        args = frappe.parse_json(args)

    address = args.get("address")
    parent_address = args.get("parent_address")

    if not address:
        frappe.throw("Delivery address is required to create the Installation Order.")

    def item_filter(doc):
        return True if parent_address else doc.custom_address == address

    def postprocess(source_doc, target_doc):
        target_doc.customer_address = address

    doc = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Installation Order",
                "field_map": {
                    "customer": "customer",
                    "name": "sales_order",
                    "delivery_date": "installation_date",
                },
            },
            "Sales Order Item": {
                "doctype": "Installation Order Item",
                "field_map": {"custom_contact": "contact"},
                "condition": item_filter,
            },
        },
        target_doc,
        postprocess=postprocess,
    )
    customer_email = frappe.db.get_value(
        "Customer",
        frappe.db.get_value("Sales Order", source_name, "customer"),
        "email_id",
    )
    doc.customer_email = customer_email

    return doc


def set_contract_type(doc):
    """
    Set the custom_contract_type for the current Sales Order based on the total custom_no_of_cars
    for the same customer across all their Sales Orders.
    """
    if not doc.customer:
        frappe.throw(_("Customer is required to set the contract type."))

    # Calculate the total custom_no_of_cars for this customer across all their sales orders
    total_cars_for_customer = frappe.db.sum(
        "Sales Order",
        filters={"customer": doc.customer, "docstatus": 1},  # Only consider submitted orders
        fieldname="custom_no_of_cars",
    )

    # Determine the contract type based on the total cars for this customer
    if total_cars_for_customer and total_cars_for_customer >= 5:
        doc.custom_contract_type = "B2B"
    else:
        doc.custom_contract_type = "B2C"


@frappe.whitelist()
def get_customer_address_and_contacts_list(customer):
    if not customer:
        return []

    addresses = frappe.get_all(
        "Dynamic Link",
        filters={
            "link_doctype": "Customer",
            "link_name": customer,
            "parenttype": "Address",
        },
        pluck="parent",
    )

    contacts = frappe.get_all(
        "Dynamic Link",
        filters={
            "link_doctype": "Customer",
            "link_name": customer,
            "parenttype": "Contact",
        },
        pluck="parent",
    )

    return addresses, contacts
