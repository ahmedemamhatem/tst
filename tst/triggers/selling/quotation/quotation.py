import frappe

@frappe.whitelist()
def get_quotation_template_items(template_name):
    # Do your own permission checking here if needed!
    return frappe.get_all(
        "Quotation Templet Item",
        filters={"parent": template_name},
        fields=["item_code", "item_name", "uom", "idx"],  # Include `idx` field
        order_by="idx asc"  # Sort by `idx` in ascending order
    )