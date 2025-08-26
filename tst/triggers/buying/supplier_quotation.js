frappe.ui.form.on("Supplier Quotation", {
    before_save: function(frm) {
        if (frm.doc.company) {
            frappe.db.get_list("Purchase Taxes and Charges Template", {
                filters: { company: frm.doc.company, disabled: 0, is_default: 1 },
                fields: ["name"],
                limit: 1
            }).then(r => {
                if (r && r.length > 0) {
                    let template_name = r[0].name;

                    // set the template
                    frm.set_value("taxes_and_charges", template_name);

                    // fetch full doc including child table
                    frappe.db.get_doc("Purchase Taxes and Charges Template", template_name)
                        .then(doc => {
                            if (doc.taxes && doc.taxes.length > 0) {
                                // clear existing taxes first
                                frm.clear_table("taxes");

                                // copy rows
                                doc.taxes.forEach(d => {
                                    let row = frm.add_child("taxes");
                                    row.charge_type = d.charge_type;
                                    row.account_head = d.account_head;
                                    row.rate = d.rate;
                                    row.tax_amount = d.tax_amount;
                                    row.description = d.description;
                                    row.cost_center = d.cost_center;
                                    row.base_tax_amount = d.base_tax_amount;
                                    // add any other fields you need from template row
                                });
                                frm.refresh_field("taxes");
 }
                        });
                }
            });
            }
    }});

