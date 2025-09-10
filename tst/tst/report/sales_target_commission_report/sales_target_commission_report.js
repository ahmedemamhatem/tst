// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

frappe.query_reports["Sales Target Commission Report"] = {
	"filters": [
		{
			"fieldname": "transaction_type",
			"label": __("Transaction Type"),
			"fieldtype": "Select",
			"options": ["Sales Order", "Sales Invoice"],
			"default": "Sales Order",
			"reqd": 1
		},
		{
			"fieldname": "target_type",
			"label": __("Target Type"),
			"fieldtype": "Select",
			"options": [
				"Total Target Item Quantity",
				"Total Target Item Selling amount", 
				"Sales Target By Item"
			],
			"default": "Total Target Item Quantity",
			"reqd": 1
		},
		{
			"fieldname": "employee",
			"label": __("Employee"),
			"fieldtype": "Link",
			"options": "Employee"
		},
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date"
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date"
		}
	],
	
	"formatter": function(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		
		if (column.fieldname == "achievement_percent") {
			if (data && data.achievement_percent !== undefined) {
				var percent = data.achievement_percent;
				if (percent >= 100) {
					value = "<span style='color:green;font-weight:bold'>" + value + "</span>";
				} else if (percent >= 80) {
					value = "<span style='color:orange;font-weight:bold'>" + value + "</span>";
				} else {
					value = "<span style='color:red;font-weight:bold'>" + value + "</span>";
				}
			}
		}
		
		if (column.fieldname == "variance") {
			if (data && data.variance !== undefined) {
				var variance = data.variance;
				if (variance >= 0) {
					value = "<span style='color:green;font-weight:bold'>+" + Math.abs(variance).toFixed(2) + "</span>";
				} else {
					value = "<span style='color:red;font-weight:bold'>-" + Math.abs(variance).toFixed(2) + "</span>";
				}
			}
		}
		
		return value;
	}
};
