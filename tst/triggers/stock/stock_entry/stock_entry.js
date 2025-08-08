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
        if (frm.doc.custom_repack_bom) {
            // Call the custom server-side method
            frappe.call({
                method: 'tst.api.get_repack_bom_details', // Custom API endpoint
                args: {
                    repack_bom_name: frm.doc.custom_repack_bom
                },
                callback: function (r) {
                    if (r.message) {
                        const bom = r.message;

                        // Clear the items table
                        frm.clear_table('items');

                        // Add the main item as the finished good (incoming item)
                        if (bom.main_item) {
                            frm.add_child('items', {
                                item_code: bom.main_item.item_code,
                                qty: bom.main_item.qty,  // Incoming quantity
                                uom: bom.main_item.uom,
                                t_warehouse: bom.main_item.default_warehouse,  // Target Warehouse
                                conversion_factor: 1,  // Default Conversion Factor for main item
                                stock_qty: bom.main_item.qty * 1,  // Qty as per Stock UOM (qty * conversion_factor)
                                transfer_qty: bom.main_item.qty * 1  // Qty as per Stock UOM (qty * conversion_factor)
                            });
                        }

                        // Add BOM child items as consumables (outgoing items)
                        if (bom.child_items && bom.child_items.length > 0) {
                            bom.child_items.forEach((child) => {
                                frm.add_child('items', {
                                    item_code: child.item_code,
                                    qty: child.qty,  // Outgoing quantity (negative for consumed items)
                                    uom: child.uom,
                                    s_warehouse: child.default_warehouse,  // Source Warehouse
                                    conversion_factor: child.conversion_factor || 1,  // Conversion Factor
                                    stock_qty: child.qty * (child.conversion_factor || 1),  // Qty as per Stock UOM
                                    transfer_qty: child.qty * (child.conversion_factor || 1)  // Qty as per Stock UOM
                                });
                            });
                        }

                        // Refresh the items table
                        frm.refresh_field('items');
                    } else {
                        frappe.msgprint(__('No data returned for the selected Repack BOM.'));
                    }
                },
                error: function (error) {
                    frappe.msgprint(__('Failed to fetch Repack BOM details. Please try again.'));
                    console.error(error); // Log error details to the console for debugging
                }
            });
        } else {
            frappe.msgprint(__('Please select a Repack BOM before proceeding.'));
        }
    }
});