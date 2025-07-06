frappe.ui.form.on('Quotation', {
    onload(frm) {
        toggle_print_and_email_buttons(frm);
    },

    refresh(frm) {
        // Remove "Set as Lost" after load
        setTimeout(() => {
            frm.remove_custom_button(__('Set as Lost'));
        }, 300);

        toggle_print_and_email_buttons(frm);

        // WhatsApp Button — always available
        frm.add_custom_button('إرسال واتساب', function () {
            const allowed_states = ["Supervisor Approved", "موافقه المشرف"];
            if (!allowed_states.includes(frm.doc.workflow_state) && frappe.session.user !== "Administrator") {
                frappe.msgprint({
                    title: __('خطأ'),
                    message: __('لا يمكنك إرسال الرسالة إلا بعد موافقة المشرف.'),
                    indicator: 'red'
                });
                return;
            }

            frappe.call({
                method: "tst.whatsapp.create_wh_massage_with_attachment",
                args: {
                    quotation_name: frm.doc.name,
                    doctype: frm.doctype
                },
                callback(r) {
                    if (!r.exc) {
                        frappe.msgprint(r.message.msg || 'تم إنشاء رسالة الواتساب بنجاح مع الإرفاق.');
                    }
                },
                error() {
                    frappe.msgprint('حدث خطأ أثناء إنشاء رسالة الواتساب أو إرفاق الملف.');
                },
                freeze: true,
                freeze_message: 'يرجى الانتظار حتى يتم إرسال الرسالة...'
            });
        });

        // Email Button — always available
        frm.add_custom_button('إرسال البريد الإلكتروني  ', function () {
            const allowed_states = ["Supervisor Approved", "موافقه المشرف"];
            if (!allowed_states.includes(frm.doc.workflow_state) && frappe.session.user !== "Administrator") {
                frappe.msgprint({
                    title: __('خطأ'),
                    message: __('لا يمكنك إرسال البريد إلا بعد موافقة المشرف.'),
                    indicator: 'red'
                });
                return;
            }

            const send_email = (email) => {
                frappe.call({
                    method: "tst.email.send_quotation_with_signature",
                    args: {
                        quotation_name: frm.doc.name,
                        recipient: email
                    },
                    callback(r) {
                        if (!r.exc) {
                            frappe.msgprint(__('تم إرسال البريد الإلكتروني بنجاح!'));
                        }
                    },
                    error() {
                        frappe.msgprint(__('حدث خطأ أثناء إرسال البريد الإلكتروني.'));
                    }
                });
            };

            if (frm.doc.contact_email) {
                frappe.confirm(
                    __('هل تريد الإرسال إلى {0}؟', [frm.doc.contact_email]),
                    () => send_email(frm.doc.contact_email)
                );
            } else {
                frappe.prompt([
                    {
                        fieldname: 'recipient',
                        label: 'البريد الإلكتروني للمستلم',
                        fieldtype: 'Data',
                        reqd: 1
                    }
                ], (values) => {
                    if (values.recipient) {
                        send_email(values.recipient);
                    }
                }, __('إدخال البريد الإلكتروني'), __('إرسال'));
            }
        });

        // Auto-load number of cars if linked to Lead
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            frappe.db.get_doc('Lead', frm.doc.party_name).then((lead_doc) => {
                frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
            });
        }
    },

    party_name(frm) {
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            frappe.db.get_doc('Lead', frm.doc.party_name).then((lead_doc) => {
                frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
                frm.reload_doc();
            });
        }
    },

    quotation_to(frm) {
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            frappe.db.get_doc('Lead', frm.doc.party_name).then((lead_doc) => {
                frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
            });
        } else {
            frm.set_value('custom_number_of_cars', null);
            frm.reload_doc();
        }
    },

    custom_quotation_templet(frm) {
        frm.clear_table('items');
        frm.refresh_field('items');

        if (!frm.doc.custom_quotation_templet) return;

        frappe.call({
            method: "tst.triggers.selling.quotation.quotation.get_quotation_template_items",
            args: {
                template_name: frm.doc.custom_quotation_templet
            },
            callback(r) {
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
            error() {
                frappe.msgprint(__('Could not fetch template items. Please check your permissions or network connection.'));
            }
        });
    }
});

// Show/hide print/email buttons based on approval state
function toggle_print_and_email_buttons(frm) {
    const valid_states = ["Supervisor Approved", "موافقه المشرف"];
    const workflow_state = frm.doc.workflow_state?.trim();
    const print_titles = ["Print", "طباعة"];
    const email_titles = ["Email", "البريد الإلكتروني"];
    const action = valid_states.includes(workflow_state) ? "show" : "hide";

    if (frm.page && frm.page.wrapper) {
        [...print_titles, ...email_titles].forEach(title => {
            frm.page.wrapper.find(`.btn[data-original-title="${title}"]`)[action]();
        });
    }

    frappe.after_ajax(() => {
        setTimeout(() => {
            if (frm.page && frm.page.menu) {
                [...print_titles, ...email_titles].forEach(text => {
                    frm.page.menu.find(`a:contains("${text}")`).closest("li")[action]();
                });
            }
        }, 300);
    });
}

// Hide Print/Email from List View if showing draft
frappe.listview_settings['Quotation'] = {
    refresh(listview) {
        let draft_filter = listview.filter_area?.filter_list?.some(filter =>
            filter.fieldname === "docstatus" && (filter.value === 0 || filter.value === "0")
        );
        let has_draft_row = listview.data.some(row => row.docstatus === 0 || row.docstatus === "0");

        if (draft_filter || has_draft_row) {
            listview.page.btn_print?.hide();
            listview.page.btn_email?.hide();
            listview.page.wrapper
                .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"]')
                .hide();
        }
    },
    onload(listview) {
        listview.page.btn_print?.hide();
        listview.page.btn_email?.hide();
        listview.page.wrapper
            .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"]')
            .hide();
    }
};
// Hide Print/Email from List View if showing draft
frappe.listview_settings['Quotation'].onload = function (listview) {
    listview.page.btn_print?.hide();
    listview.page.btn_email?.hide();
    listview.page.wrapper
        .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"]')
        .hide();
}