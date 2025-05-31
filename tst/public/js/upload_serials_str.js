frappe.ui.form.on('Stock Reconciliation Item', {
    custom_upload_file(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        // 🟡 Check: Is the row saved (does it have an idx)?
        if (!row.idx) {
            frappe.msgprint(__('Please save this row first before uploading serials.'));
            return; // Stop here if not saved!
        }

        // 🟡 Check: Is the document in draft?
        if (frm.doc.docstatus !== 0) {
            frappe.msgprint(__('You can only upload serials in Draft.'));
            return; // Stop if not draft
        }

        // 🟢 All checks passed — open dialog
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
                        doctype: frm.doc.doctype // Will be "Stock Reconciliation"
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