
import frappe


@frappe.whitelist()
def after_insert(doc, method=None):
    # Update appointment status if reference is present
    if doc.custom_reference_doctype and doc.custom_reference_link:
        frappe.db.set_value(
            doc.custom_reference_doctype,
            doc.custom_reference_link,
            "custom_appointment_status",
            "Out of Stock"
        )



@frappe.whitelist()
def validate(doc, method=None):
    # Set installation order from reference
    if doc.custom_reference_doctype and doc.custom_reference_link:
        doc.custom_installation_order = frappe.db.get_value(
            doc.custom_reference_doctype,
            doc.custom_reference_link,
            "custom_installation_order"
        )


@frappe.whitelist()
def set_department_in_items(doc, method=None):
    
    """
    For each item row, set department (if field exists) from Employee's department.
    Throws an error if Employee or department is not found.
    """
    # Fetch Employee department
    employee = frappe.db.get_value(
        "Employee",
        {"user_id": doc.owner},
        ["name", "department"],
        as_dict=True
    )
    if not employee:
        frappe.throw("No Employee found for user {}".format(doc.owner))
    if not employee.get("department"):
        frappe.throw("Department not set for Employee '{}'.".format(employee["name"]))

    # Loop through items child table
    for item in doc.get("items", []):
        if hasattr(item, "department"):
            item.department = employee["department"]

            # After insert, update DB directly if needed
            if not getattr(doc, "__islocal", False):
                frappe.db.set_value(item.doctype, item.name, "department", employee["department"])


@frappe.whitelist()
def on_submit(doc, method=None):
    pass
