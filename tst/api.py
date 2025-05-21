import os
import frappe
import pandas as pd
import io

@frappe.whitelist()
def upload_serials_from_file(file_url, docname, row_idx, doctype):
    # Step 1: Resolve file path
    rel_path = file_url.lstrip('/')
    abs_path = os.path.join(frappe.get_site_path(), rel_path)
    if not os.path.isfile(abs_path):
        frappe.throw(f"File not found at resolved path: {abs_path}")

    # Step 2: Read file as Excel or CSV
    with open(abs_path, "rb") as f:
        filecontent = f.read()
    try:
        df = pd.read_excel(io.BytesIO(filecontent))
    except Exception:
        df = pd.read_csv(io.BytesIO(filecontent))

    # Step 3: Get serials
    if 'serial' not in df.columns:
        frappe.throw('No column named "serial" found in the uploaded file.')
    serials = df['serial'].dropna().astype(str).tolist()

    # Step 4: Get the qty from the correct child row
    doc = frappe.get_doc(doctype, docname)
    items = doc.items
    # row_idx is typically 1-based in ERPNext grid, so subtract 1 for Python list index
    row_number = int(row_idx) - 1
    if row_number < 0 or row_number >= len(items):
        frappe.throw(f"Row index {row_idx} is invalid for items table.")
    item_row = items[row_number]

    qty = float(item_row.qty)
    serials_count = len(serials)

    # Step 5: Validate qty vs serials count
    if serials_count != int(qty):
        frappe.throw(
            f"Serials count ({serials_count}) does not match row quantity ({int(qty)}). "
            "Please upload the correct number of serial numbers."
        )

    # Step 6: Return serials string
    serials_str = "\n".join(serials)
    return {"serials": serials_str}