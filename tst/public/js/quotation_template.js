frappe.ui.form.on('Quotation', {
    custom_quotation_templet: function(frm) {
        // Clear the items table whenever the template is (re)selected
        frm.clear_table('items');
        frm.refresh_field('items');

        // If no template selected, do nothing
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
                // Permission error or other failure
                if (r.exc) {
                    frappe.msgprint(__('Could not fetch template items. Permission denied or server error.'));
                    return;
                }
                if (r.message && Array.isArray(r.message) && r.message.length > 0) {
                    r.message.forEach(function(item){
                        if(item.item_code) {
                            let child = frm.add_child("items");
                            child.item_code = item.item_code;
                        }
                    });
                    frm.refresh_field('items');
                } else {
                    frappe.msgprint(__('No items found in the selected quotation template.'));
                }
            },
            error: function(xhr) {
                // Handle server/network errors
                frappe.msgprint(__('Could not fetch template items. Please check your permissions or network connection.'));
            }
        });
    }
});