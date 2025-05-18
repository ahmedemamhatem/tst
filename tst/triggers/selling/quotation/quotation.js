frappe.ui.form.on('Quotation', {
    onload: function(frm) {
        // Check if the document is in draft (docstatus === 0)
        if (frm.doc.docstatus === 0) {
            // Hide the print button
            $("button[data-original-title=Print]").hide();
        }
    },
    refresh: function(frm) {
        // Check if the document is in draft (docstatus === 0)
        if (frm.doc.docstatus === 0) {
            // Hide the print button again during refresh
            $("button[data-original-title=Print]").hide();
        }
    },
});


frappe.ui.form.on('Quotation', {
    custom_quotation_templet: function(frm) {
        frm.clear_table('items');
        frm.refresh_field('items');

        if (!frm.doc.custom_quotation_templet) return;

        frappe.call({
            method: "tst.override.get_template_items",
            args: {
                template_name: frm.doc.custom_quotation_templet
            },
            callback: function(r) {
                if (r.message && Array.isArray(r.message) && r.message.length > 0) {
                    r.message.forEach(function(item){
                        if (item.item) {
                            let child = frm.add_child("items");
                            child.item_code = item.item;
                        }
                    });
                    frm.refresh_field('items');
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