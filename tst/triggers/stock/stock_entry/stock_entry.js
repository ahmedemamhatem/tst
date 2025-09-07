frappe.ui.form.on('Stock Entry', {
  setup: function(frm) {
    set_stock_entry_type_query(frm);
  },
  onload: function(frm) {
    set_stock_entry_type_query(frm);
  },
  refresh: function(frm) {
    set_stock_entry_type_query(frm);
  }
});

function set_stock_entry_type_query(frm) {
  frm.set_query('stock_entry_type', function() {
    return {
      filters: {
        custom_enabled: 1
      }
    };
  });
}


frappe.ui.form.on('Stock Entry', {
    custom_repack_bom: function (frm) {
        if (!frm.doc.custom_repack_bom) {
            frappe.msgprint(__('Please select a Repack BOM before proceeding.'));
            return;
        }

        // Fetch BOM details when a BOM is selected
        frappe.call({
            method: 'tst.api.get_repack_bom_details', // Custom API endpoint
            args: {
                repack_bom_name: frm.doc.custom_repack_bom
            },
            callback: function (r) {
                if (r.message) {
                    const bom = r.message;

                    // Validate BOM data
                    if (!bom.main_item && (!bom.child_items || bom.child_items.length === 0)) {
                        return;
                    }

                    // Store the fetched BOM details in the form for reuse
                    frm.doc.fetched_bom_details = bom;

                    // Refresh items based on the initial quantity
                    update_items_table(frm, bom, frm.doc.custom_repack_bom_qty || 1);
                } else {
                    frappe.msgprint(__('No data returned for the selected Repack BOM.'));
                }
            },
            error: function (error) {
                console.error('Error fetching BOM details:', error);
            }
        });
    },

    custom_repack_bom_qty: function (frm) {
        // Update the items table dynamically when the quantity is changed
        if (frm.doc.fetched_bom_details) {
            const bom = frm.doc.fetched_bom_details;
            const new_qty = frm.doc.custom_repack_bom_qty || 1;

            // Clear and update the items table
            update_items_table(frm, bom, new_qty);
        } else {
            frappe.msgprint(__('Please select a Repack BOM first.'));
        }
    }
});

// Helper function to update the items table based on quantity
function update_items_table(frm, bom, qty) {
    // Clear all items
    frm.clear_table('items');

    // Add the main item as the finished good (incoming item)
    if (bom.main_item) {
        const main_qty = bom.main_item.qty * qty;

        frm.add_child('items', {
            item_code: bom.main_item.item_code,
            qty: main_qty, // Adjusted quantity
            uom: bom.main_item.uom,
            t_warehouse: bom.main_item.default_warehouse, // Target Warehouse
            conversion_factor: 1, // Default Conversion Factor for the main item
            stock_qty: main_qty, // Qty as per Stock UOM
            transfer_qty: main_qty // Qty as per Stock UOM
        });
    }

    // Add child items as consumables (outgoing items)
    if (bom.child_items && bom.child_items.length > 0) {
        bom.child_items.forEach((child) => {
            const child_qty = child.qty * qty * (child.conversion_factor || 1);

            frm.add_child('items', {
                item_code: child.item_code,
                qty: child_qty, // Adjusted quantity
                uom: child.uom,
                s_warehouse: child.default_warehouse, // Source Warehouse
                conversion_factor: child.conversion_factor || 1, // Conversion Factor
                stock_qty: child_qty, // Qty as per Stock UOM
                transfer_qty: child_qty // Qty as per Stock UOM
            });
        });
    }

    // Refresh the items table to display updated rows
    frm.refresh_field('items');
}