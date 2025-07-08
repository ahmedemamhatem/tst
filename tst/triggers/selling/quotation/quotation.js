frappe.ui.form.on('Quotation', {
    onload(frm) {
        // Hide default Print and Email buttons on form load
        hide_default_print_email(frm);
    },

    refresh(frm) {
        // Remove "Set as Lost" button after a short delay
        setTimeout(() => {
            frm.remove_custom_button(__('Set as Lost'));
        }, 300);

        // Hide default Print and Email buttons every refresh
        hide_default_print_email(frm);

        // Custom button: Print Quotation as PDF (Arabic)
        frm.add_custom_button('طباعة عرض السعر', function () {
            if (!frm.doc.custom_quotation_templet) {
                frappe.msgprint('يرجى اختيار قالب عرض السعر أولاً.');
                return;
            }
            // Fetch Quotation Template to get the print format
            frappe.db.get_doc('Quotation Template', frm.doc.custom_quotation_templet)
                .then(template => {
                    if (!template || !template.print_format) {
                        frappe.msgprint('لم يتم تحديد نموذج طباعة في قالب عرض السعر المحدد.');
                        return;
                    }
                    // Build PDF download URL
                    let url = '/api/method/frappe.utils.print_format.download_pdf'
                        + `?doctype=${encodeURIComponent(frm.doctype)}`
                        + `&name=${encodeURIComponent(frm.doc.name)}`
                        + `&format=${encodeURIComponent(template.print_format)}`
                        + `&letterhead=${encodeURIComponent(frm.doc.letter_head || "None")}`
                        + `&no_letterhead=0`
                        + `&_lang=${encodeURIComponent(frappe.boot.lang || 'ar')}`;
                    // Open PDF in a new tab
                    window.open(url, '_blank');
                });
        });

        // Custom button: Send via WhatsApp (Arabic)
        frm.add_custom_button('إرسال واتساب', function () {
            if (!can_send(frm)) return; // Permission check

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

        // Custom button: Send Email (Arabic)
        frm.add_custom_button('إرسال البريد الإلكتروني', function () {
            if (!can_send(frm)) return; // Permission check

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

            // Use contact_email if available, otherwise prompt for email
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

        // Auto-load number of cars from Lead if linked
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            update_number_of_cars_from_lead(frm, frm.doc.party_name);
        }
    },

    // When party_name changes, reload number of cars if Lead is selected
    party_name(frm) {
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            update_number_of_cars_from_lead(frm, frm.doc.party_name, true);
        }
    },

    // When quotation_to changes, reload or clear number of cars accordingly
    quotation_to(frm) {
        if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
            update_number_of_cars_from_lead(frm, frm.doc.party_name);
        } else {
            frm.set_value('custom_number_of_cars', null);
            frm.refresh_field('custom_number_of_cars');
            frm.reload_doc();
        }
    },

    // When changing the quotation template, reload items
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
                    frappe.msgprint('لم يتم العثور على عناصر في قالب عرض السعر المحدد.');
                }
            },
            error() {
                frappe.msgprint('تعذر جلب عناصر القالب. يرجى مراجعة الصلاحيات أو الاتصال بالشبكة.');
            }
        });
    }
});

// Helper: Check if user is allowed to send WhatsApp/Email
function can_send(frm) {
    const allowed_states = ["Supervisor Approved", "موافقه المشرف"];
    if (!allowed_states.includes(frm.doc.workflow_state) && frappe.session.user !== "Administrator") {
        frappe.msgprint({
            title: 'خطأ',
            message: 'لا يمكنك تنفيذ هذه العملية إلا بعد موافقة المشرف.',
            indicator: 'red'
        });
        return false;
    }
    return true;
}

// Helper: Update "number of cars" field from Lead document
function update_number_of_cars_from_lead(frm, lead_name, reload=false) {
    frappe.db.get_doc('Lead', lead_name).then((lead_doc) => {
        frm.set_value('custom_number_of_cars', lead_doc.custom_number_of_cars);
        if (reload) frm.reload_doc();
    });
}

// Hide default Print and Email buttons on the form
function hide_default_print_email(frm) {
    frappe.after_ajax(() => {
        setTimeout(() => {
            if (frm.page && frm.page.wrapper) {
                frm.page.wrapper.find('.btn[data-original-title="Print"], .btn[data-original-title="Email"], .btn[data-label="Print"], .btn[data-label="Email"]').hide();
            }
            if (frm.page && frm.page.menu) {
                frm.page.menu.find('a:contains("Print"), a:contains("Email")').closest("li").hide();
            }
        }, 300);
    });
}

// Hide default Print and Email buttons in the Quotation list view
frappe.listview_settings['Quotation'] = {
    refresh(listview) {
        if (listview.page && listview.page.btn_print) {
            listview.page.btn_print.hide();
        }
        if (listview.page && listview.page.btn_email) {
            listview.page.btn_email.hide();
        }
        if (listview.page && listview.page.wrapper) {
            listview.page.wrapper
                .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"], .btn[data-label="Print"], .btn[data-label="Email"]')
                .hide();
        }
    },
    onload(listview) {
        if (listview.page && listview.page.btn_print) {
            listview.page.btn_print.hide();
        }
        if (listview.page && listview.page.btn_email) {
            listview.page.btn_email.hide();
        }
        if (listview.page && listview.page.wrapper) {
            listview.page.wrapper
                .find('.btn[data-original-title="Print"], .btn[data-original-title="Email"], .btn[data-label="Print"], .btn[data-label="Email"]')
                .hide();
        }
    }
};