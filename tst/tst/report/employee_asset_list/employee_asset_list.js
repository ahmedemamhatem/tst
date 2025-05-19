frappe.query_reports["Employee Asset List"] = {
    filters: [
        {
            fieldname: "employee",
            label: __("Employee"),
            fieldtype: "Link",
            options: "Employee"
        },
        {
            fieldname: "location",
            label: __("Location"),
            fieldtype: "Data"
        },
        {
            fieldname: "status",
            label: __("Status"),
            fieldtype: "Select",
            options: "\nSubmitted\nActive\nScrapped\nSold"
        }
    ]
};