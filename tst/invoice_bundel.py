import frappe

def fill_items_from_product_bundles(doc, method=None):
    """
    On before_validate: If custom_product_bundle is checked,
    always clear and fill items table from product bundles.
    """
    if not getattr(doc, "custom_product_bundle", None):
        return

    # Always clear items
    doc.items = []

    # Go through each selected product bundle
    for pb_row in doc.get("custom_invoice_product_bundle", []):
        bundle = frappe.get_doc("Product Bundle", pb_row.product_bundle)
        for bundle_item in bundle.items:
            item_qty = (bundle_item.qty or 0) * (pb_row.qty or 0)
            item_rate = (pb_row.product_bundle_rate or 0) * (bundle_item.custom_rate_percent or 0) / 100

            new_row = doc.append("items", {})
            new_row.item_code = bundle_item.item_code
            new_row.qty = item_qty
            new_row.rate = item_rate
            new_row.description = getattr(bundle_item, "item_name", "")
            # Add other fields as needed