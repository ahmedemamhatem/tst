frappe.ui.form.on('Supplier', {
    refresh(frm) {
        if (!frm.doc.__islocal) {
            frm.add_custom_button(__('Create Data Submission Form'), function () {
                // ✅ Check if email is missing
                if (!frm.doc.custom_contact_person_email) {
                    frappe.msgprint(__('Please fill Contact Person Email before creating Data Submission Form'));
                    frappe.validated = false;
                    return;
                }

                const new_doc = frappe.model.get_new_doc("Supplier Data Complete");

                // Map fields from Supplier
                new_doc.supplier = frm.doc.name;
                new_doc.supplier_full_name=frm.doc.custom_supplier_full_name,
                new_doc.company = frm.doc.supplier_name;
                new_doc.job_title = frm.doc.custom_contact_person_job_title;
                new_doc.email = frm.doc.custom_contact_person_email;
                new_doc.mobile_number = frm.doc.custom_contact_person_mobile_no;
                new_doc.contact_person_name = frm.doc.custom_contact_person_name;

                // Function to finally redirect once everything is set
                const redirect_to_new_doc = () => {
                    frappe.set_route("Form", "Supplier Data Complete", new_doc.name);
                };

                let promises = [];

                // Fetch contact info if available
                if (frm.doc.supplier_primary_contact) {
                    let contact_promise = frappe.db.get_doc("Contact", frm.doc.supplier_primary_contact).then(contact => {
                        let contact_name = contact.first_name || "";
                        if (contact.last_name) {
                            contact_name += " " + contact.last_name;
                        }

                        new_doc.phone_number = contact.mobile_no;
                        new_doc.company_email = contact.email_id;
                    });
                    promises.push(contact_promise);
                }

                // Fetch address info if available
                if (frm.doc.supplier_primary_address) {
                    let address_promise = frappe.db.get_doc("Address", frm.doc.supplier_primary_address).then(address => {
                        new_doc.address = address.address_line1 || "";
                    });
                    promises.push(address_promise);
                }

                // Wait for all async calls before redirecting
                if (promises.length > 0) {
                    Promise.all(promises).then(() => {
                        redirect_to_new_doc();
                    });
                } else {
                    redirect_to_new_doc();
                }
            });
        }
    },
    supplier_name: function(frm){
        frm.set_value("custom_supplier_full_name",frm.doc.supplier_name)
        frm.refresh_field("custom_supplier_full_name")
    }
});
