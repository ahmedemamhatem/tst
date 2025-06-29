frappe.ui.form.on('Quotation', {
    refresh: function(frm) {
        frm.add_custom_button('إرسال واتساب', function() {
            const allowed_states = ["Supervisor Approved", "موافقه المشرف"];
            if (!allowed_states.includes(frm.doc.workflow_state)) {
                frappe.msgprint({
                    title: __('خطأ'),
                    message: __('لا يمكنك إرسال الرسالة إلا بعد موافقة المشرف.'),
                    indicator: 'red'
                });
                return;
            }
            // Call backend directly, no prompt
            frappe.call({
                method: "tst.whatsapp.create_wh_massage_with_attachment",
                args: {
                    quotation_name: frm.doc.name,
                    doctype: frm.doctype // Pass doctype as well
                },
                callback: function(r) {
                    if (!r.exc) {
                        frappe.msgprint(r.message.msg || 'تم إنشاء رسالة الواتساب بنجاح مع الإرفاق.');
                    }
                },
                error: function() {
                    frappe.msgprint('حدث خطأ أثناء إنشاء رسالة الواتساب أو إرفاق الملف.');
                },
                freeze: true,
                freeze_message: 'يرجى الانتظار حتى يتم إرسال الرسالة...'
            });
        });
    }
});

frappe.ui.form.on('Quotation', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button('إرسال البريد الإلكتروني  ', function() {

                // Check workflow state
                const allowed_states = ["Supervisor Approved", "موافقه المشرف"];
                if (!allowed_states.includes(frm.doc.workflow_state)) {
                    frappe.msgprint({
                        title: __('خطأ'),
                        message: __('لا يمكنك إرسال البريد إلا بعد موافقة المشرف.'),
                        indicator: 'red'
                    });
                    return;
                }

                let send_email = function(email) {
                    frappe.call({
                        method: "tst.email.send_quotation_with_signature", // حدّث المسار حسب تطبيقك
                        args: {
                            quotation_name: frm.doc.name,
                            recipient: email
                        },
                        callback: function(r) {
                            if (!r.exc) {
                                frappe.msgprint(__('تم إرسال البريد الإلكتروني بنجاح!'));
                            }
                        },
                        error: function() {
                            frappe.msgprint(__('حدث خطأ أثناء إرسال البريد الإلكتروني.'));
                        }
                    });
                };

                // If contact_email exists, confirm, else prompt
                if(frm.doc.contact_email) {
                    frappe.confirm(
                        __('هل تريد الإرسال إلى {0}؟', [frm.doc.contact_email]),
                        function() {
                            send_email(frm.doc.contact_email);
                        },
                        function() {
                            // المستخدم ألغى العملية
                        }
                    );
                } else {
                    frappe.prompt([
                        {
                            fieldname: 'recipient',
                            label: 'البريد الإلكتروني للمستلم',
                            fieldtype: 'Data',
                            reqd: 1
                        }
                    ], function(values) {
                        if(values.recipient) {
                            send_email(values.recipient);
                        }
                    }, __('إدخال البريد الإلكتروني'), __('إرسال'));
                }
            });
        }
    }
});


frappe.ui.form.on('Quotation', {
    party_name: function(frm) {
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            frappe.db.get_doc('Lead', frm.doc.party_name).then(function(lead_doc) {
                frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
            });
        }
    },
    quotation_to: function(frm) {
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            frappe.db.get_doc('Lead', frm.doc.party_name).then(function(lead_doc) {
                frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
            });
        } else {
            frm.set_value('custom_number_of_cars', null);
        }
    },
    refresh: function(frm) {
        // On form load, ensure the value is set if needed
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            frappe.db.get_doc('Lead', frm.doc.party_name).then(function(lead_doc) {
                frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
            });
        }
    }
});

frappe.ui.form.on('Quotation', {
    onload: function(frm) {
        toggle_print_and_email_buttons(frm);
    },
    refresh: function(frm) {
        setTimeout(() => {
            frm.remove_custom_button(__('Set as Lost'));
        }, 300);
        toggle_print_and_email_buttons(frm);
    },
    refresh: function (frm) {
        // On form load, ensure the value is set if needed
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            frappe.db.get_doc('Lead', frm.doc.party_name).then(function (lead_doc) {
                frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
            });
        }
    }
});

frappe.ui.form.on('Quotation', {
    onload: function (frm) {
        toggle_print_and_email_buttons(frm);
    },
    refresh: function (frm) {
        setTimeout(() => {
            frm.remove_custom_button(__('Set as Lost'));
        }, 300);
        toggle_print_and_email_buttons(frm);
    },
    custom_quotation_templet: function (frm) {
        frm.clear_table('items');
        frm.refresh_field('items');
        if (!frm.doc.custom_quotation_templet) return;

        frappe.call({
            method: "tst.triggers.selling.quotation.quotation.get_quotation_template_items",
            args: {
                template_name: frm.doc.custom_quotation_templet
            },
            callback: function (r) {
                console.log('Custom endpoint Quotation Templet Items return:', r);
                if (r.message && Array.isArray(r.message) && r.message.length > 0) {
                    r.message.forEach(function (item) {
                        if (item.item_code) {
                            let child = frm.add_child("items");
                            child.item_code = item.item_code;
                            child.item_name = item.item_name;
                            child.uom = item.uom;
                        }
                    });
                    frm.refresh_field('items');
                } else {
                    frappe.msgprint(__('No items found in the selected quotation template.'));
                }
            },
            error: function (xhr) {
                frappe.msgprint(__('Could not fetch template items. Please check your permissions or network connection.'));
            }
        });
    }
});

// Hide Print and Email in form view (toolbar + menu) only if draft
function toggle_print_and_email_buttons(frm) {
    // Debug log to check the current workflow state
    console.log("Current Workflow State:", frm.doc.workflow_state);

    // Valid workflow states where buttons should appear
    const valid_states = ["Supervisor Approved", "موافقه المشرف"];

    // Get the current workflow state and trim any extra spaces
    const workflow_state = frm.doc.workflow_state?.trim();

    // Titles/texts for Print and Email buttons in both languages
    const print_titles = ["Print", "طباعة"];
    const email_titles = ["Email", "البريد الإلكتروني"];

    // Check if the current state matches the valid states
    if (valid_states.includes(workflow_state)) {
        console.log("Workflow state matches. Showing Print and Email buttons.");

        // Show toolbar buttons by data-original-title
        if (frm.page && frm.page.wrapper) {
            print_titles.concat(email_titles).forEach((title) => {
                frm.page.wrapper
                    .find(`.btn[data-original-title="${title}"]`)
                    .show();
            });
        }

        // Show menu items (Print/Email) with a delay for menu rendering
        frappe.after_ajax(() => {
            setTimeout(() => {
                if (frm.page && frm.page.menu) {
                    print_titles.concat(email_titles).forEach((text) => {
                        frm.page.menu
                            .find(`a:contains("${text}")`)
                            .closest("li")
                            .show();
                    });
                }
            }, 300); // Short delay to ensure menu rendering
        });
    } else {
        console.log("Workflow state does NOT match. Hiding Print and Email buttons.");

        // Hide toolbar buttons by data-original-title
        if (frm.page && frm.page.wrapper) {
            print_titles.concat(email_titles).forEach((title) => {
                frm.page.wrapper
                    .find(`.btn[data-original-title="${title}"]`)
                    .hide();
            });
        }

        // Hide menu items (Print/Email) with a delay for menu rendering
        frappe.after_ajax(() => {
            setTimeout(() => {
                if (frm.page && frm.page.menu) {
                    print_titles.concat(email_titles).forEach((text) => {
                        frm.page.menu
                            .find(`a:contains("${text}")`)
                            .closest("li")
                            .hide();
                    });
                }
            }, 300); // Short delay to ensure menu rendering
        });
    }
}

// List view: Hide Print and Email only if filtering by Draft (docstatus=0)
frappe.listview_settings['Quotation'] = {
    refresh: function (listview) {
        // Check if list is filtered to drafts (docstatus == 0)
        let draft_filter = listview.filter_area
            && listview.filter_area.filter_list
            && listview.filter_area.filter_list.some(filter =>
                filter.fieldname === "docstatus" && (filter.value === 0 || filter.value === "0")
            );
        // If not filtered, or if at least one row is draft, hide buttons
        let has_draft_row = listview.data.some(row => row.docstatus === 0 || row.docstatus === "0");
        if (draft_filter || has_draft_row) {
            listview.page.btn_print && listview.page.btn_print.hide();
            listview.page.btn_email && listview.page.btn_email.hide();
            listview.page.wrapper
                .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"]')
                .hide();
        }
    },
    onload: function (listview) {
        // Also hide on load if possible
        listview.page.btn_print && listview.page.btn_print.hide();
        listview.page.btn_email && listview.page.btn_email.hide();
        listview.page.wrapper
            .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"]')
            .hide();
    }
};
