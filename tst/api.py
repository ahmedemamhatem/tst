import os
import frappe
import pandas as pd
import io

@frappe.whitelist()
def upload_serials_from_file(file_url, docname, row_idx, doctype):
    # file_url is like /private/files/Items (3).csv or /public/files/Items (3).csv
    # Remove leading slash for os.path.join
    rel_path = file_url.lstrip('/')
    abs_path = os.path.join(frappe.get_site_path(), rel_path)
    
    if not os.path.isfile(abs_path):
        frappe.throw(f"File not found at resolved path: {abs_path}")

    with open(abs_path, "rb") as f:
        filecontent = f.read()

    # Try reading as Excel, then as CSV
    try:
        df = pd.read_excel(io.BytesIO(filecontent))
    except Exception:
        df = pd.read_csv(io.BytesIO(filecontent))

    if 'serial' not in df.columns:
        frappe.throw('No column named "serial" found in the uploaded file.')

    serials = df['serial'].dropna().astype(str).tolist()
    serials_str = "\n".join(serials)

    return {"serials": serials_str}