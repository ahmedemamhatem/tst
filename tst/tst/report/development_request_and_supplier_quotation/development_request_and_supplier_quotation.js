frappe.query_reports["Development Request and Supplier Quotation"] = {
    "filters": [
        {
            "fieldname": "development_request",
            "label": "Development Request",
            "fieldtype": "Link",
            "options": "Development Request",
            "reqd": 1,  // Mandatory filter
            "width": "200px"
        },
        {
            "fieldname": "customer",
            "label": "Customer",
            "fieldtype": "Link",
            "options": "Customer",
            "reqd": 0,  // Optional filter
            "width": "150px"
        },
       
        {
            "fieldname": "start_date",
            "label": "Start Date",
            "fieldtype": "Date",
            "default": moment().startOf('year').format('YYYY-MM-DD'),  // Start of the current year
            "reqd": 1,
            "width": "120px"
        },
        {
            "fieldname": "end_date",
            "label": "End Date",
            "fieldtype": "Date",
            "default": moment().format('YYYY-MM-DD'),  // Today's date
            "reqd": 1,
            "width": "120px"
        }
    ]
};