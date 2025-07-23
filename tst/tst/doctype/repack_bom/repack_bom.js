// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Repack BOM", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('Repack BOM', {
    onload: function(frm) {
        // Filter for the "main_item" field in the parent Doctype
        frm.set_query('main_item', function() {
            return {
                filters: {
                    disabled: 0,  // Only active items
                    is_stock_item: 1 // Items with stock
                }
            };
        });

        // Filter for "item_code" in the child table "Repack BOM Item"
        frm.fields_dict['table_wlal'].grid.get_field('item_code').get_query = function(doc, cdt, cdn) {
            // If `main_item` is not set, return no results
            if (!frm.doc.main_item) {
                return {
                    filters: {
                        name: ['=', ''] // This will return no results
                    }
                };
            }
            // Otherwise, apply the filters to exclude `main_item`
            return {
                filters: {
                    disabled: 0,  // Only active items
                    is_stock_item: 1, // Items with stock
                    name: ['!=', frm.doc.main_item] // Exclude the main_item from the parent
                }
            };
        };
    },

    refresh: function(frm) {
        // Ensure filters are also applied during refresh
        frm.fields_dict['table_wlal'].grid.get_field('item_code').get_query = function(doc, cdt, cdn) {
            // If `main_item` is not set, return no results
            if (!frm.doc.main_item) {
                return {
                    filters: {
                        name: ['=', ''] // This will return no results
                    }
                };
            }
            // Otherwise, apply the filters to exclude `main_item`
            return {
                filters: {
                    disabled: 0,  // Only active items
                    is_stock_item: 1, // Items with stock
                    name: ['!=', frm.doc.main_item] // Exclude the main_item from the parent
                }
            };
        };
    }
});