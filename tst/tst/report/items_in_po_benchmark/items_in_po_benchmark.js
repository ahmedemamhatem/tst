
frappe.query_reports["Items In PO Benchmark"] = {
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
			"fieldname": "occurrences",
			"label": "Occurence",
			"fieldtype": "Int",
			"default": 3
		}
		
	]
};