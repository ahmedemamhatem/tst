frappe.ui.form.on('Purchase Invoice', {
    refresh: function (frm) {
        // Only show the dialog if needed
        if (frm.doc.docstatus === 1) {
            if (frm.doc.custom_landed_cost === 1) {
                frm.add_custom_button(
                    __('Create Landed Cost Voucher'),
                    function () {
                        frm.events.create_landed_cost_voucher(frm);
                    }
                );
            } else if (frm.doc.custom_landed_cost === 0) {
                // Define a function to show the dialog, so it can be called recursively
                function show_yes_only_dialog() {
                    let action_taken = false;
                    let d = new frappe.ui.Dialog({
                        title: __("Confirmation"),
                        fields: [
                            {
                                fieldtype: "HTML",
                                options: '<div style="margin: 20px 0; font-size: 1.1em; text-align: center;">'
                                    + __("Create Landed Cost Voucher for this Purchase Invoice?")
                                    + '</div>'
                            }
                        ],
                        primary_action_label: __("Yes"),
                        primary_action: function () {
                            action_taken = true;
                            d.hide();
                            frappe.call({
                                method: 'frappe.client.set_value',
                                args: {
                                    doctype: 'Purchase Invoice',
                                    name: frm.doc.name,
                                    fieldname: 'custom_landed_cost',
                                    value: 1
                                },
                                callback: function (r) {
                                    if (!r.exc) {
                                        frm.reload_doc();
                                        frappe.show_alert({ message: __('Updated'), indicator: 'green' });
                                    }
                                }
                            });
                        }
                    });

                    // Remove the close (X) button
                    d.$wrapper.find('.modal-header .close').remove();

                    // Prevent closing by ESC or clicking outside
                    var $modal = d.$wrapper.closest('.modal');
                    $modal.attr('data-backdrop', 'static');
                    $modal.attr('data-keyboard', 'false');
                    $modal.modal({ backdrop: 'static', keyboard: false });

                    // If dialog is closed by any means except "Yes", re-show it
                    $modal.on('hide.bs.modal', function (e) {
                        setTimeout(function () {
                            if (!action_taken) show_yes_only_dialog();
                        }, 200);
                    });

                    d.show();
                }

                // Show dialog for the first time
                show_yes_only_dialog();
            }
        }
    },
    create_landed_cost_voucher: function (frm) {
        frappe.call({
            method: "erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_lcv",
            args: {
                doctype: frm.doc.doctype,
                docname: frm.doc.name,
            },
            callback: (r) => {
                if (r.message) {
                    var doc = frappe.model.sync(r.message);
                    frappe.set_route("Form", doc[0].doctype, doc[0].name);
                }
            }
        });
    }
});