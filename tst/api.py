import os
import frappe
import pandas as pd
import io
from erpnext.stock.utils import get_stock_balance


@frappe.whitelist()
def upload_serials_from_file(file_url, docname, row_idx, doctype):
    """
    Reads an uploaded CSV/XLSX file, extracts the 'serial' column,
    and returns the serials as a \n-separated string for the correct child row.
    """
    if not file_url:
        frappe.throw("File URL is required.")

    # Step 1: Resolve file path
    rel_path = file_url.lstrip("/")
    abs_path = os.path.join(frappe.get_site_path(), rel_path)
    if not os.path.isfile(abs_path):
        frappe.throw(f"File not found at resolved path: {abs_path}")

    # Step 2: Read file as Excel or CSV (by extension, fallback by content)
    ext = abs_path.split(".")[-1].lower()
    filecontent = None
    with open(abs_path, "rb") as f:
        filecontent = f.read()
    df = None

    if ext in ("xlsx", "xls"):
        try:
            df = pd.read_excel(io.BytesIO(filecontent))
        except Exception as e:
            frappe.throw(f"Unable to read Excel file: {e}")
    elif ext == "csv":
        try:
            df = pd.read_csv(io.BytesIO(filecontent))
        except Exception as e:
            frappe.throw(f"Unable to read CSV file: {e}")
    else:
        # Try reading as Excel, then as CSV
        try:
            df = pd.read_excel(io.BytesIO(filecontent))
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(filecontent))
            except Exception:
                frappe.throw("File must be an Excel (.xlsx) or CSV (.csv) file.")

    # Step 3: Ensure 'serial' column exists
    if "serial" not in (c.lower() for c in df.columns):
        frappe.throw(
            'No column named "serial" found in the uploaded file. (Case-insensitive match expected)'
        )
    # Find the actual column name for robust case-insensitivity
    serial_col = next(col for col in df.columns if col.lower() == "serial")
    serials = df[serial_col].dropna().astype(str).map(str.strip).tolist()
    serials = [s for s in serials if s]

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
    if int(qty) != serials_count:
        frappe.throw(
            f"Serials count ({serials_count}) does not match row quantity ({int(qty)}). "
            "Please upload the correct number of serial numbers."
        )

    # Step 6: Return serials string
    serials_str = "\n".join(serials)
    return {"serials": serials_str}


def get_fields(doctype, fields=None):
    if fields is None:
        fields = []
    meta = frappe.get_meta(doctype)
    fields.extend(meta.get_search_fields())

    if meta.title_field and meta.title_field.strip() not in fields:
        fields.insert(1, meta.title_field.strip())

    return unique(fields)


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def serial_and_batch_bundle_query(
    doctype, txt, searchfield, start, page_len, filters, as_dict=False
):
    doctype = "Serial and Batch Bundle"
    searchfields = frappe.get_meta(doctype).get_search_fields()
    searchfields = " or ".join(
        "sbb." + field + " like %(txt)s" for field in searchfields
    )

    return frappe.db.sql(
        """select sbb.name, sbb.item_code, sbb.item_name
        from `tabSerial and Batch Bundle` sbb
        join `tabStock Entry Detail` sed on sed.name = sbb.voucher_detail_no  
        where sbb.docstatus = 1
          and sbb.voucher_type = "Stock Entry"
          and sed.custom_installation_order = %(installation_order)s
          and sbb.type_of_transaction = "Inward"
            and ({key} like %(txt)s
                or sbb.item_name like %(txt)s
                or sbb.item_code like %(txt)s
                or {scond})
        order by
            (case when locate(%(_txt)s, sbb.name) > 0 then locate(%(_txt)s, sbb.name) else 99999 end),
            (case when locate(%(_txt)s, sbb.item_name) > 0 then locate(%(_txt)s, sbb.item_name) else 99999 end),
            (case when locate(%(_txt)s, sbb.item_code) > 0 then locate(%(_txt)s, sbb.item_code) else 99999 end),
            sbb.idx desc,
            sbb.name, sbb.item_name
        limit %(page_len)s offset %(start)s""".format(
            **{
                "key": "sbb." + searchfield,
                "scond": searchfields,
            }
        ),
        {
            "txt": "%%%s%%" % txt,
            "_txt": txt.replace("%", ""),
            "start": start,
            "page_len": page_len,
            "installation_order": filters.get("custom_installation_order"),
        },
    )


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def serial_no_query(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    doctype = "Serial No"
    searchfields = frappe.get_meta(doctype).get_search_fields()
    searchfields = " or ".join(field + " like %(txt)s" for field in searchfields)
    installation_items = frappe.db.get_all(
        "Installation Order Item",
        filters={
            "parent": filters.get("custom_installation_order"),
        },
        pluck="item_code",
    )

    return frappe.db.sql(
        """select name, item_code, item_name
        from `tabSerial No`
        where status = "Active"
        and item_code in %(installation_items)s
        and warehouse = %(warehouse)s
            and ({key} like %(txt)s
                or item_name like %(txt)s
                or item_code like %(txt)s
                or {scond})
        order by
            (case when locate(%(_txt)s, name) > 0 then locate(%(_txt)s, name) else 99999 end),
            (case when locate(%(_txt)s, item_name) > 0 then locate(%(_txt)s, item_name) else 99999 end),
            (case when locate(%(_txt)s, item_code) > 0 then locate(%(_txt)s, item_code) else 99999 end),
            idx desc,
            name, item_name
        limit %(page_len)s offset %(start)s""".format(
            **{
                "key": searchfield,
                "scond": searchfields,
            }
        ),
        {
            "txt": "%%%s%%" % txt,
            "_txt": txt.replace("%", ""),
            "start": start,
            "page_len": page_len,
            "installation_items": tuple(installation_items),
            "warehouse": filters.get("warehouse"),
        },
    )
