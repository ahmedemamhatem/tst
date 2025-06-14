frappe.ui.form.on('Quotation', {
    onload: function(frm) {
        hide_print_and_email_on_draft(frm);
    },
    refresh: function(frm) {
        hide_print_and_email_on_draft(frm);
    },
    custom_quotation_templet: function(frm) {
        frm.clear_table('items');
        frm.refresh_field('items');
        if (!frm.doc.custom_quotation_templet) return;

        frappe.call({
            method: "tst.triggers.selling.quotation.quotation.get_quotation_template_items",
            args: {
                template_name: frm.doc.custom_quotation_templet
            },
            callback: function(r) {
                console.log('Custom endpoint Quotation Templet Items return:', r);
                if (r.message && Array.isArray(r.message) && r.message.length > 0) {
                    r.message.forEach(function(item) {
                        if (item.item_code) {
                            let child = frm.add_child("items");
                            child.item_code = item.item_code;
                            child.item_name = item.item_name;
                            child.uom = item.uom;
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

// Hide Print and Email in form view (toolbar + menu) only if draft
function hide_print_and_email_on_draft(frm) {
    if (frm.doc.docstatus === 0) {
        // Titles/texts to match in both languages
        var print_titles = ['Print', 'طباعة'];
        var email_titles = ['Email', 'البريد الإلكتروني'];

        // Hide toolbar buttons by data-original-title (Print, Email in both languages)
        print_titles.concat(email_titles).forEach(function(title) {
            frm.page && frm.page.wrapper &&
                frm.page.wrapper.find('.btn[data-original-title="' + title + '"]').hide();
        });

        // Hide toolbar buttons (legacy references)
        if (frm.page && frm.page.btn_print) frm.page.btn_print.hide();
        if (frm.page && frm.page.btn_email) frm.page.btn_email.hide();

        // Hide from menu (wait for menu to render)
        setTimeout(function() {
            if (frm.page && frm.page.menu) {
                // Hide menu items with Print/Email (English and Arabic)
                print_titles.forEach(function(text) {
                    frm.page.menu.find('a:contains("' + text + '")').closest('li').hide();
                });
                email_titles.forEach(function(text) {
                    frm.page.menu.find('a:contains("' + text + '")').closest('li').hide();
                });
            }
        }, 150); // Delay for menu build
    }
}

// List view: Hide Print and Email only if filtering by Draft (docstatus=0)
frappe.listview_settings['Quotation'] = {
    refresh: function(listview) {
        // Check if list is filtered to drafts (docstatus == 0)
        let draft_filter = listview.filter_area
            && listview.filter_area.filter_list
            && listview.filter_area.filter_list.some(filter =>
                filter.fieldname === "docstatus" && (filter.value === 0 || filter.value === "0")
            );
        // If not filtered, or if at least one row is draft, hide buttons
        let has_draft_row = listview.data.some(row => row.docstatus === 0 || row.docstatus === "0");
        if (draft_filter || has_draft_row) {
            listview.page.btn_print && listview.page.btn_print.hide();
            listview.page.btn_email && listview.page.btn_email.hide();
            listview.page.wrapper
                .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"]')
                .hide();
        }
    },
    onload: function(listview) {
        // Also hide on load if possible
        listview.page.btn_print && listview.page.btn_print.hide();
        listview.page.btn_email && listview.page.btn_email.hide();
        listview.page.wrapper
            .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"]')
            .hide();
    }
};