frappe.ui.form.on('Purchase Receipt', {
    refresh: function(frm) {
        frm.add_custom_button(__('Upload Serials'), function() {
            let items = frm.doc.items || [];
            if (!items.length) {
                frappe.msgprint(__('Please add at least one item row first.'));
                return;
            }
            // Always use the first row (index 0)
            let row = items[0];

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
                        callback: function(r) {
                            if (r.message && r.message.serials) {
                                frappe.model.set_value('Purchase Receipt Item', row.name, "serial_no", r.message.serials);
                                frappe.msgprint(__('Serial numbers uploaded and set for the first row.'));
                            } else {
                                frappe.msgprint(__('No serials found in the file.'));
                            }
                        }
                    });
                    dialog.hide();
                }
            });
            dialog.show();
        });
    }
});