frappe.query_reports["Product Bundle Profitability"] = {
    "filters": [
        
        {
            "fieldname": "from_date",
            "label": "From Date",
            "fieldtype": "Date"
        },
        {
            "fieldname": "to_date",
            "label": "To Date",
            "fieldtype": "Date"
        },
		{
            "fieldname": "invoice",
            "label": "Sales Invoice",
            "fieldtype": "Link",
            "options": "Sales Invoice"
        },
        {
            "fieldname": "bundle",
            "label": "Product Bundle",
            "fieldtype": "Link",
            "options": "Item"
        }
    ]
};