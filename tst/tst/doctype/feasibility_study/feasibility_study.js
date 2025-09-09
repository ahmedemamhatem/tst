// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Feasibility Study", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on("Feasibility Study", {
    onload: function (frm) {
        // Filter for Development Request
        frm.set_query('development_request', function () {
            return {
                filters: {
                    status: 'Submitted'
                }
            };
        });
    }
});