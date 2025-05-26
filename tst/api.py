import os
import frappe
import pandas as pd
import io

import json
from collections import OrderedDict, defaultdict

import frappe
from frappe import qb, scrub
from frappe.desk.reportview import get_filters_cond, get_match_cond
from frappe.utils import cint, nowdate, today, unique



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
def serial_and_batch_bundle_query(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    doctype = "Serial and Batch Bundle"
    searchfields = frappe.get_meta(doctype).get_search_fields()
    searchfields = " or ".join('sbb.' + field + " like %(txt)s" for field in searchfields)

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
            {mcond}
        order by
            (case when locate(%(_txt)s, sbb.name) > 0 then locate(%(_txt)s, sbb.name) else 99999 end),
            (case when locate(%(_txt)s, sbb.item_name) > 0 then locate(%(_txt)s, sbb.item_name) else 99999 end),
            (case when locate(%(_txt)s, sbb.item_code) > 0 then locate(%(_txt)s, sbb.item_code) else 99999 end),
            sbb.idx desc,
            sbb.name, sbb.item_name
        limit %(page_len)s offset %(start)s""".format(
            **{
                "key": 'sbb.'+searchfield,
                "scond": searchfields,
                "mcond": get_match_cond(doctype),
            }
        ),
        {"txt": "%%%s%%" % txt, 
   "_txt": txt.replace("%", ""), 
   "start": start, 
   "page_len": page_len, 
   "installation_order": filters.get("custom_installation_order")}, 
    )


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def serial_no_query(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    doctype = "Serial No"
    searchfields = frappe.get_meta(doctype).get_search_fields()
    searchfields = " or ".join(field + " like %(txt)s" for field in searchfields)
    appointment_with_same_installation_order = frappe.db.get_all(
        "Appointment",
        filters={"docstatus": ["!=", 2], "custom_installation_order": filters.get("custom_installation_order")},
        pluck="name"
    )
    return frappe.db.sql(
        """select name, item_code, item_name
        from `tabSerial No`
        where status = "Active"
        and name in (
            select distinct serial_no
            from `tabSerial and Batch Entry` 
            where docstatus = 1
            and parent = %(custom_serial_and_batch_bundle)s
            and parenttype = "Serial and Batch Bundle"
            and parentfield = "entries"
        )
        and name not in (
            select distinct serial_no
            from `tabChoose Serial and Batch Bundle`
            where parent in %(appointment_with_same_installation_order)s
            and parenttype = "Appointment"
        )
            and ({key} like %(txt)s
                or item_name like %(txt)s
                or item_code like %(txt)s
                or {scond})
            {mcond}
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
                "mcond": get_match_cond(doctype),
            }
        ),
        {"txt": "%%%s%%" % txt, 
   "_txt": txt.replace("%", ""), 
   "start": start, 
   "page_len": page_len, 
   "custom_serial_and_batch_bundle": filters.get("custom_serial_and_batch_bundle"),
   "appointment_with_same_installation_order": tuple(appointment_with_same_installation_order) 
   }, 

    )