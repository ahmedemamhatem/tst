frappe.ui.form.on("Supplier", {
    refresh: function(frm) {
        frappe.msgprint("")
        if (!frm.is_new()) {
            frm.add_custom_button(__("Create Data Submission Form"), function() {
                if (!frm.doc.supplier_primary_contact) {
                    frappe.msgprint(__("Please select a Primary Contact first."));
                    return;
                }

                // Fetch contact info
                frappe.db.get_doc("Contact", frm.doc.supplier_primary_contact).then(contact => {
                    let contact_name = contact.first_name;
                    if (contact.last_name) {
                        contact_name += " " + contact.last_name;
                    }

                    // Create Supplier Data Complete
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                doctype: "Supplier Data Complete",
                                supplier: frm.doc.name,  
                            company: frm.doc.company,
                            phone_number: frm.doc.mobile_no,
                            company_email: frm.doc.email_id,
                            contact_person_name: frm.doc.supplier_primary_contact,
                                contact_person: contact_name,
                                job_title: contact.job_title,
                                mobile_no: contact.mobile_no,
                                email:contact.email_id
                            }
                        },
                        callback: function(r) {
                            if (!r.exc) {
                                frappe.msgprint(__("Supplier Data Complete created: " + r.message.name));
                                frappe.set_route("Form", "Supplier Data Complete", r.message.name);
                            }
                        }
                    });
                });
            }).addClass("btn-primary");
        }
    }
});
