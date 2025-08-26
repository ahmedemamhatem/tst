frappe.ui.form.on("Supplier Quotation", {
    onload: function(frm) {
        // frappe.msgprint("tst")
        if (frm.doc.company) {
            frappe.db.get_value(
                "Purchase Taxes and Charges Template",
                { company: frm.doc.company, disabled: 0, is_default: 1 },
                "name"
            ).then(r => {
                if (r.message && r.message.name) {
                    frm.set_value("taxes_and_charges", r.message.name);
                    frm.refresh_field("taxes_and_charges")
                }
            });
        }
    }
});
