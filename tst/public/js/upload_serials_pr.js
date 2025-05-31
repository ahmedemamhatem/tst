frappe.ui.form.on('Purchase Receipt Item', {
    custom_upload_file(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        // 1️⃣ Check: Only allow in Draft
        if (frm.doc.docstatus !== 0) {
            frappe.msgprint(__('You can only upload serials in Draft.'));
            return;
        }
        // 2️⃣ Check: Parent document must be saved (not new)
        if (frm.is_new()) {
            frappe.msgprint(__('Please save the document before uploading serials.'));
            return;
        }
        // 3️⃣ Check: Row must be saved (has an idx)
        if (!row.idx) {
            frappe.msgprint(__('Please save this row first before uploading serials.'));
            return;
        }

        // 4️⃣ Open the upload dialog if all checks pass
        let dialog = new frappe.ui.Dialog({
            title: __('Upload Serial Numbers'),
            fields: [
                {
                    label: 'Serial Numbers File (Excel or CSV, column named "serial")',
                    fieldname: 'serials_file',
                    fieldtype: 'Attach',
                    reqd: 1
                }
            ],
            primary_action_label: __('Upload'),
            primary_action(values) {
                if (!values.serials_file) {
                    frappe.msgprint(__('Please upload a file.'));
                    return;
                }
                frappe.call({
                    method: "tst.api.upload_serials_from_file",
                    args: {
                        file_url: values.serials_file,
                        docname: frm.doc.name,
                        row_idx: row.idx,
                        doctype: frm.doc.doctype
                    },
                    freeze: true,
                    callback: function(r) {
                        if (r.message && r.message.serials) {
                            frappe.model.set_value(cdt, cdn, "serial_no", r.message.serials);
                            frappe.msgprint(__('Serial numbers uploaded and set for this row.'));
                        } else {
                            frappe.msgprint(__('No serials found in the file.'));
                        }
                    }
                });
                dialog.hide();
            }
        });
        dialog.show();
    }
});

// frappe.ui.form.on('Purchase Receipt', {
//     refresh: function(frm) {
//         // Show button only if doc is in Draft and not local/unsaved
//         if (frm.doc.docstatus === 0 && !frm.is_new()) {
//             frm.add_custom_button(__('Upload Serials'), function() {
//                 let items = frm.doc.items || [];
//                 if (!items.length) {
//                     frappe.msgprint(__('Please add at least one item row first.'));
//                     return;
//                 }
//                 // Always use the first row (index 0)
//                 let row = items[0];

//                 let dialog = new frappe.ui.Dialog({
//                     title: __('Upload Serial Numbers'),
//                     fields: [
//                         {
//                             label: 'Serial Numbers File (Excel or CSV, column named "serial")',
//                             fieldname: 'serials_file',
//                             fieldtype: 'Attach',
//                             reqd: 1
//                         }
//                     ],
//                     primary_action_label: __('Upload'),
//                     primary_action(values) {
//                         if (!values.serials_file) {
//                             frappe.msgprint(__('Please upload a file.'));
//                             return;
//                         }
//                         frappe.call({
//                             method: "tst.api.upload_serials_from_file",
//                             args: {
//                                 file_url: values.serials_file,
//                                 docname: frm.doc.name,
//                                 row_idx: row.idx,
//                                 doctype: frm.doc.doctype
//                             },
//                             callback: function(r) {
//                                 if (r.message && r.message.serials) {
//                                     frappe.model.set_value('Purchase Receipt Item', row.name, "serial_no", r.message.serials);
//                                     frappe.msgprint(__('Serial numbers uploaded and set for the first row.'));
//                                 } else {
//                                     frappe.msgprint(__('No serials found in the file.'));
//                                 }
//                             }
//                         });
//                         dialog.hide();
//                     }
//                 });
//                 dialog.show();
//             });
//         }
//     }
// });