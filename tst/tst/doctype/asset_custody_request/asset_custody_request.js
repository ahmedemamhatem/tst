frappe.ui.form.on('Asset Custody Request', {
    refresh(frm) {
        // Show only if the document is saved
        if (frm.doc.docstatus == 1  && frm.doc.name) {
            if (frm.doc.request_type === "From Store") {
                frm.add_custom_button('New Asset Movement', () => {
                    frappe.new_doc('Asset Movement', {
                        "custom_asset_custody_request": frm.doc.name
                    });
                }, __("Actions"));
            }
            if (frm.doc.request_type === "Purchase New Asset") {
                frm.add_custom_button('New Material Request', () => {
                    frappe.new_doc('Material Request', {
                        "custom_asset_custody_request": frm.doc.name
                    });
                }, __("Actions"));
            }
        }
    }
});