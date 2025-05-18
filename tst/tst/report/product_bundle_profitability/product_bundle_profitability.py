import frappe

def execute(filters=None):
    columns = [
        {"label": "Sales Invoice", "fieldname": "invoice", "fieldtype": "Link", "options": "Sales Invoice"},
        {"label": "Posting Date", "fieldname": "posting_date", "fieldtype": "Date"},
        {"label": "Customer", "fieldname": "customer", "fieldtype": "Link", "options": "Customer"},
        {"label": "Salesperson", "fieldname": "sales_person", "fieldtype": "Data"},
        {"label": "Product Bundle", "fieldname": "bundle", "fieldtype": "Link", "options": "Item"},
        {"label": "Bundle Description", "fieldname": "bundle_description", "fieldtype": "Data", "width": 200},
        {"label": "Invoice Qty", "fieldname": "invoice_qty", "fieldtype": "Float"},
        {"label": "UOM", "fieldname": "uom", "fieldtype": "Data"},
        {"label": "Bundle Cost Per Unit", "fieldname": "bundle_cost_per_unit", "fieldtype": "Currency"},
        {"label": "Total Bundle Cost", "fieldname": "bundle_cost", "fieldtype": "Currency"},
        {"label": "Selling Price Per Unit", "fieldname": "selling_price_per_unit", "fieldtype": "Currency"},
        {"label": "Total Selling Price", "fieldname": "selling_price", "fieldtype": "Currency"},
        {"label": "Profit Margin", "fieldname": "profit_margin", "fieldtype": "Currency"},
        {"label": "Gross Profit %", "fieldname": "profit_percent", "fieldtype": "Percent"},
        {"label": "Invoice Net Total", "fieldname": "invoice_net_total", "fieldtype": "Currency"},
        {"label": "Bundle Items (Detail)", "fieldname": "details", "fieldtype": "Data", "width": 500}
    ]
    data = []

    # Build filters for Sales Invoice Item
    sii_filters = {"docstatus": 1}
    if filters:
        if filters.get("invoice"):
            sii_filters["parent"] = filters["invoice"]
        if filters.get("bundle"):
            sii_filters["item_code"] = filters["bundle"]

    # Date filter: get invoices in the given date range
    invoices_in_range = None
    if filters and (filters.get("from_date") or filters.get("to_date")):
        date_filters = []
        if filters.get("from_date"):
            date_filters.append("posting_date >= %(from_date)s")
        if filters.get("to_date"):
            date_filters.append("posting_date <= %(to_date)s")
        if date_filters:
            query = f"""
                SELECT name FROM `tabSales Invoice`
                WHERE {' AND '.join(date_filters)} AND docstatus = 1
            """
            invoices_in_range = [row[0] for row in frappe.db.sql(query, filters, as_list=True)]
            if invoices_in_range:
                sii_filters["parent"] = ["in", invoices_in_range]
            else:
                return columns, []

    invoice_items = frappe.get_all(
        "Sales Invoice Item",
        filters=sii_filters,
        fields=["parent", "item_code", "rate", "qty", "uom", "description"]
    )

    if not invoice_items:
        return columns, []

    invoice_names = list({item.parent for item in invoice_items})
    bundle_codes = list({item.item_code for item in invoice_items})

    # Fetch all needed Sales Invoice info in batch
    invoice_info_map = {}
    for row in frappe.db.get_all(
        "Sales Invoice",
        filters={"name": ["in", invoice_names]},
        fields=["name", "customer", "posting_date", "net_total"]
    ):
        invoice_info_map[row.name] = row

    # Fetch all bundle custom_total and description in one query
    bundle_info_map = {}
    for row in frappe.db.get_all(
        "Product Bundle",
        filters={"name": ["in", bundle_codes]},
        fields=["name", "custom_total", "description"]
    ):
        bundle_info_map[row.name] = row

    # Fetch all bundle items for these bundles in one query
    all_bundle_items = frappe.db.get_all(
        "Product Bundle Item",
        filters={"parent": ["in", bundle_codes]},
        fields=["parent", "item_code", "qty", "custom_valuation_rate", "custom_total"]
    )
    # Fetch item names for details
    all_item_codes = list({row["item_code"] for row in all_bundle_items})
    item_name_map = {}
    for it in frappe.db.get_all(
        "Item",
        filters={"name": ["in", all_item_codes]},
        fields=["name", "item_name"]
    ):
        item_name_map[it.name] = it.item_name

    bundle_items_map = {}
    for row in all_bundle_items:
        bundle_items_map.setdefault(row.parent, []).append(row)

    # Fetch all salespersons for these invoices (first salesperson only)
    sales_person_map = {}
    sales_team_rows = frappe.db.get_all(
        "Sales Team",
        filters={"parenttype": "Sales Invoice", "parent": ["in", invoice_names]},
        fields=["parent", "sales_person"],
        order_by="idx asc"
    )
    for row in sales_team_rows:
        if row.parent not in sales_person_map:
            sales_person_map[row.parent] = row.sales_person

    for inv_item in invoice_items:
        invoice_qty = float(inv_item.qty)
        bundle_row = bundle_info_map.get(inv_item.item_code, {})
        bundle_cost_per_unit = float(bundle_row.get("custom_total") or 0)
        total_bundle_cost = bundle_cost_per_unit * invoice_qty
        selling_price_per_unit = float(inv_item.rate)
        total_selling_price = selling_price_per_unit * invoice_qty
        profit_margin = total_selling_price - total_bundle_cost
        profit_percent = (profit_margin / total_bundle_cost * 100) if total_bundle_cost else 0
        bundle_description = bundle_row.get("description", "")

        # Invoice info
        invoice_info = invoice_info_map.get(inv_item.parent, {})
        customer = invoice_info.get("customer", "")
        posting_date = invoice_info.get("posting_date", "")
        invoice_net_total = invoice_info.get("net_total", 0)
        sales_person = sales_person_map.get(inv_item.parent, "")

        # Details string
        details = bundle_items_map.get(inv_item.item_code, [])
        details_str = "; ".join([
            f"{d['item_code']} - {item_name_map.get(d['item_code'], '')} "
            f"(Qty {d['qty']}, Rate {d.get('custom_valuation_rate')}, Amount {d.get('custom_total')})"
            for d in details
        ])

        data.append({
            "invoice": inv_item.parent,
            "posting_date": posting_date,
            "customer": customer,
            "sales_person": sales_person,
            "bundle": inv_item.item_code,
            "bundle_description": bundle_description,
            "invoice_qty": invoice_qty,
            "uom": inv_item.uom,
            "bundle_cost_per_unit": bundle_cost_per_unit,
            "bundle_cost": total_bundle_cost,
            "selling_price_per_unit": selling_price_per_unit,
            "selling_price": total_selling_price,
            "profit_margin": profit_margin,
            "profit_percent": profit_percent,
            "invoice_net_total": invoice_net_total,
            "details": details_str
        })

    return columns, data