frappe.query_reports["Serials In Warehouse"] = {
    filters: [
        {
            fieldname: "item_code",
            label: __("Item"),
            fieldtype: "Link",
            options: "Item"
        },
        {
            fieldname: "warehouse",
            label: __("Warehouse"),
            fieldtype: "Link",
            options: "Warehouse"
        },
        {
            fieldname: "from_date",
            label: __("Purchase Date From"),
            fieldtype: "Date"
        },
        {
            fieldname: "to_date",
            label: __("Purchase Date To"),
            fieldtype: "Date"
        }
    ]
};