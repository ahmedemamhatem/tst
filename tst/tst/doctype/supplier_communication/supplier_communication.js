// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Supplier Communication", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('Supplier Communication', {
    onload: function (frm) {
        // Filter for Development Request
        frm.set_query('development_request', function () {
            return {
                filters: {
                    status: 'Submitted'
                }
            };
        });

        // Filter for Supplier
        frm.set_query('supplier', function () {
            return {
                filters: {
                    disabled: 0 // Only active suppliers (not disabled)
                }
            };
        });
    }
});