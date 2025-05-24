import frappe
@frappe.whitelist()
def make_installation_order(source_name, target_doc=None):
    from frappe.model.mapper import get_mapped_doc

    doc = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Installation Order",
                "field_map": {
                    "customer": "customer",
                    "name": "sales_order"
                }
            },
            "Sales Order Item": {
                "doctype": "Installation Order Item",
            }
        },
        target_doc,
    )
    return doc
