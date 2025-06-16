import frappe


@frappe.whitelist()
def after_insert(doc, method=None):
    if doc.custom_reference_doctype and doc.custom_reference_link:
        frappe.db.set_value(
            doc.custom_reference_doctype,
            doc.custom_reference_link,
            "custom_appointment_status",
            "Out of Stock",
        )


@frappe.whitelist()
def validate(doc, method=None):
    doc.custom_installation_order = frappe.db.get_value(
        doc.custom_reference_doctype,
        doc.custom_reference_link,
        "custom_installation_order",
    )


@frappe.whitelist()
def on_submit(doc, method=None):
    pass
