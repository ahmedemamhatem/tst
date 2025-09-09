frappe.ui.form.on('Development Request', {
    refresh: function (frm) {
        // Ensure buttons only show after the document is submitted
        if (frm.doc.docstatus === 1) { // docstatus 1 means submitted
            // Button to create Feasibility Study
            frm.add_custom_button(__('Create Feasibility Study'), function () {
                frappe.new_doc('Feasibility Study', {
                    development_request: frm.doc.name, // Link the Development Request
                    prepared_by: frappe.session.user,  // Set the current user as Prepared By
                    posting_date: frappe.datetime.nowdate() // Set Posting Date to Today
                });
            }, __('Create'));

            // Button to create Supplier Communication
            frm.add_custom_button(__('Create Supplier Communication'), function () {
                // Show a popup to select a supplier
                frappe.prompt([
                    {
                        fieldname: 'supplier',
                        label: 'Supplier',
                        fieldtype: 'Link',
                        options: 'Supplier',
                        reqd: 1, // Make it mandatory
                        get_query: () => {
                            return {
                                filters: {
                                    disabled: 0 // Only show active suppliers
                                }
                            };
                        }
                    }
                ], function (data) {
                    // Create the Supplier Communication document with the selected supplier
                    frappe.new_doc('Supplier Communication', {
                        development_request: frm.doc.name, // Link the Development Request
                        supplier: data.supplier,          // Set the selected supplier
                        posting_date: frappe.datetime.nowdate() // Set Posting Date to Today
                    });
                }, __('Select Supplier'), __('Create'));
            }, __('Create'));
        }
    }
});


frappe.ui.form.on('Development Request', {
    refresh: function (frm) {
        if (frm.doc.docstatus === 1 ) {
            frm.add_custom_button(__('Create Item Code'), function () {
                frappe.new_doc('Item', {
                   
                });
            }, __('Create'));
        }
    }
});