// Quotation Client Script

frappe.ui.form.on('Quotation', {
    onload(frm) {
        always_hide_print_and_email(frm);
    },

    refresh(frm) {
        setTimeout(() => {
            frm.remove_custom_button(__('Set as Lost'));
        }, 300);

        always_hide_print_and_email(frm);

        // Only show custom buttons if workflow state is valid
        if (is_valid_state(frm)) {
            // --- Print Quotation Button ---
            frm.add_custom_button('طباعة عرض السعر', function () {
                if (!frm.doc.custom_quotation_templet) {
                    frappe.msgprint('يرجى اختيار قالب عرض السعر أولاً.');
                    return;
                }
                frappe.db.get_doc('Quotation Template', frm.doc.custom_quotation_templet)
                    .then(template => {
                        if (!template || !template.print_format) {
                            frappe.msgprint('لم يتم تحديد نموذج طباعة في قالب عرض السعر المحدد.');
                            return;
                        }
                        let url = '/api/method/frappe.utils.print_format.download_pdf'
                            + `?doctype=${encodeURIComponent(frm.doctype)}`
                            + `&name=${encodeURIComponent(frm.doc.name)}`
                            + `&format=${encodeURIComponent(template.print_format)}`
                            + `&letterhead=${encodeURIComponent(frm.doc.letter_head || "None")}`
                            + `&no_letterhead=0`
                            + `&_lang=ar`;
                        window.open(url, '_blank');
                    });
            });

            // --- Send Email Button ---
            frm.add_custom_button('إرسال البريد الإلكتروني', function () {
                const send_email = (email) => {
                    frappe.call({
                        method: "tst.email.send_quotation_with_signature",
                        args: {
                            quotation_name: frm.doc.name,
                            recipient: email
                        },
                        callback(r) {
                            if (!r.exc) {
                                frappe.msgprint('تم إرسال البريد الإلكتروني بنجاح!');
                            }
                        },
                        error() {
                            frappe.msgprint('حدث خطأ أثناء إرسال البريد الإلكتروني.');
                        }
                    });
                };

                if (frm.doc.contact_email) {
                    frappe.confirm(
                        `هل تريد الإرسال إلى ${frm.doc.contact_email}؟`,
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
                    }, 'إدخال البريد الإلكتروني', 'إرسال');
                }
            });

            // --- Send WhatsApp Button ---
            frm.add_custom_button('إرسال واتساب', function () {
                frappe.call({
                    method: "tst.whatsapp.create_wh_massage_with_attachment",
                    args: {
                        quotation_name: frm.doc.name,
                        doctype: frm.doctype
                    },
                    callback(r) {
                        if (!r.exc) {
                            frappe.msgprint(r.message.msg || 'تم إنشاء رسالة الواتساب بنجاح مع المرفق.');
                        }
                    },
                    error() {
                        frappe.msgprint('حدث خطأ أثناء إنشاء رسالة الواتساب أو إرفاق الملف.');
                    },
                    freeze: true,
                    freeze_message: 'يرجى الانتظار حتى يتم إرسال الرسالة...'
                });
            });
        }
    },

    // (Optional) Your other triggers like party_name, quotation_to, etc.

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
                    r.message.forEach(function(item) {
                        if (item.item_code) {
                            let child = frm.add_child("items");
                            child.item_code = item.item_code;
                            child.item_name = item.item_name;
                            child.uom = item.uom;
                        }
                    });
                    frm.refresh_field('items');
                } else {
                    frappe.msgprint('لم يتم العثور على عناصر في قالب عرض السعر المحدد.');
                }
            },
            error() {
                frappe.msgprint('تعذر جلب عناصر القالب. يرجى مراجعة الصلاحيات أو الاتصال بالشبكة.');
            }
        });
    }
});

// Helper: Only returns TRUE if workflow state is valid
function is_valid_state(frm) {
    const valid_states = ["Supervisor Approved", "موافقه المشرف"];
    const state = (frm.doc.workflow_state || "").trim();
    return valid_states.includes(state);
}

// Always hide default Print/Email (toolbar + menu, AR/EN)
function always_hide_print_and_email(frm) {
    frappe.after_ajax(() => {
        setTimeout(() => {
            const print_titles = ["Print", "طباعة"];
            const email_titles = ["Email", "البريد الإلكتروني"];
            if (frm.page && frm.page.wrapper) {
                print_titles.concat(email_titles).forEach((title) => {
                    frm.page.wrapper
                        .find(`.btn[data-original-title="${title}"], .btn[data-label="${title}"]`)
                        .hide();
                });
            }
            if (frm.page && frm.page.menu) {
                print_titles.concat(email_titles).forEach((text) => {
                    frm.page.menu
                        .find(`a:contains("${text}")`)
                        .closest("li")
                        .hide();
                });
            }
        }, 300);
    });
}

// Listview: Always hide Print/Email buttons
frappe.listview_settings['Quotation'] = {
    refresh(listview) { hide_listview_print_email(listview); },
    onload(listview) { hide_listview_print_email(listview); }
};

function hide_listview_print_email(listview) {
    const print_titles = ["Print", "طباعة"];
    const email_titles = ["Email", "البريد الإلكتروني"];
    if (listview.page) {
        if (listview.page.btn_print) listview.page.btn_print.hide();
        if (listview.page.btn_email) listview.page.btn_email.hide();
    }
    if (listview.page && listview.page.wrapper) {
        print_titles.concat(email_titles).forEach((title) => {
            listview.page.wrapper
                .find(`.btn[data-original-title="${title}"], .btn[data-label="${title}"]`)
                .hide();
        });
    }
}