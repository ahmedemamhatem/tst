frappe.ui.form.on('Quotation', {
    custom_quotation_templet: function(frm) {
        // Clear the items table whenever the template is (re)selected
        frm.clear_table('items');
        frm.refresh_field('items');
        if (!frm.doc.custom_quotation_templet) return;

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Quotation Templet Item",
                filters: {
                    parent: frm.doc.custom_quotation_templet
                },
                fields: ["item_code"]
            },
            callback: function(r) {
                if (r.exc) {
                    frappe.msgprint(__('Could not fetch template items. Permission denied or server error.'));
                    return;
                }
                if (r.message && Array.isArray(r.message) && r.message.length > 0) {
                    // For each item, fetch name and uom and set in child table
                    let item_promises = r.message.map(function(item) {
                        if (item.item_code) {
                            return frappe.db.get_value('Item', item.item_code, ['item_name', 'stock_uom']).then(function(item_details) {
                                let child = frm.add_child("items");
                                child.item_code = item.item_code;
                                if(item_details && item_details.message) {
                                    child.item_name = item_details.message.item_name;
                                    child.uom = item_details.message.stock_uom;
                                }
                            });
                        } else {
                            return Promise.resolve();
                        }
                    });

                    // Wait for all item details to be fetched before refreshing field
                    Promise.all(item_promises).then(function() {
                        frm.refresh_field('items');
                    });
                } else {
                    frappe.msgprint(__('No items found in the selected quotation template.'));
                }
            },
            error: function(xhr) {
                frappe.msgprint(__('Could not fetch template items. Please check your permissions or network connection.'));
            }
        });
    }
});