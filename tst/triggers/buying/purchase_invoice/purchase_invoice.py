import frappe
from frappe import _

@frappe.whitelist()
def validate(doc, method):
    if doc.custom_purchase_order_type:
        return

    for row in doc.items:
        if row.purchase_order:
            doc.custom_purchase_order_type = frappe.db.get_value(
                "Purchase Order",
                row.purchase_order,
                "custom_po_types"
            )


@frappe.whitelist()
def on_submit(doc, method):
    pass