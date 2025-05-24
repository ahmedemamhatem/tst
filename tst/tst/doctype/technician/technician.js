// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Technician", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('Technician', {
    refresh: function(frm) {
        // Filter Warehouse: only Technician Warehouse
        frm.set_query('warehouse', function() {
            return {
                filters: {
                    custom_warehouse_ownership: 'Technician Warehouse'
                }
            };
        });
        // Filter Employee: only enabled
        frm.set_query('employee', function() {
            return {
                filters: {
                    status: "Active"
                }
            };
        });
    }
});