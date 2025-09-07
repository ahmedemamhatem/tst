
frappe.ui.form.on('Quotation', {
    refresh(frm) {
        frm.fields_dict['items'].grid.get_field('item_code').get_query = function(doc) {
            return {
                filters: {
                    custom_is_bundle: 0,
                    is_sales_item: 1,
                    variant_of: '',
                    is_fixed_asset: 0,
                    disabled: 0
                }
            };
        };
    }
});


frappe.ui.form.on("Quotation", {
    onload: function(frm) {
        update_from_lead(frm);
    },
    party_name: function(frm) {
        update_from_lead(frm);
    }
});

function update_from_lead(frm) {
    if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
        frappe.db.get_doc("Lead", frm.doc.party_name)
            .then(lead => {
                if (lead && lead.custom_customer_name) {
                    let updates = {};

                    if (frm.doc.customer_name !== lead.custom_customer_name) {
                        updates["customer_name"] = lead.custom_customer_name;
                    }
                    if (frm.doc.title !== lead.custom_customer_name) {
                        updates["title"] = lead.custom_customer_name;
                    }

                    if (Object.keys(updates).length > 0) {
                        frm.set_value(updates);
                        frm.save(); // 🔐 only save if something changed
                    }
                }
            })
            .catch(err => {
                console.error("❌ Failed to fetch Lead:", err);
            });
    }
}

// Main setup for Quotation doctype
frappe.ui.form.on('Quotation', {
    onload(frm) {
        block_non_draft_updates(frm);
        always_hide_print_and_email(frm);
    },

    refresh(frm) {
        setTimeout(() => {
            // Select all buttons with 'data-toggle="dropdown"'
            document.querySelectorAll('button[data-toggle="dropdown"]').forEach((button) => {
                // Check if the button contains the text "Get Items From"
                if (button.textContent.trim() === 'Get Items From') {
                    // Hide the button
                    button.style.display = 'none';
                }
            });
        }, 100); 
        // Remove default "Set as Lost" button
        frm.remove_custom_button(__('Set as Lost'));

        // Remove "Get Items From" button
        frm.remove_custom_button(__('Get Items From'));

        // Always hide default Print/Email buttons
        always_hide_print_and_email(frm);

        // Add custom buttons if the workflow state is valid
        if (is_valid_state(frm)) {
            add_custom_print_button(frm); // Add custom print button
            add_custom_email_button(frm); // Add custom email button
            add_custom_whatsapp_button(frm); // Add custom WhatsApp button
        }

        // Show "Add to Item Table" button only if the document is in draft
        frm.toggle_display('custom_add_to_item_table', frm.doc.docstatus === 0);
    },

    party_name(frm) {
        update_from_lead(frm);
    },

    custom_quotation_templet(frm) {
        clear_and_fetch_template_items(frm);
    },

    custom_add_to_item_table: async function (frm) {
        await handle_custom_add_to_item_table(frm);
    }
});


// Helper: Block updates on non-draft documents
function block_non_draft_updates(frm) {
    // Block frm.set_value on non-draft
    const orig_set_value = frm.set_value.bind(frm);
    frm.set_value = function (key, val) {
        if (frm.doc.docstatus !== 0) return Promise.resolve();
        return orig_set_value(key, val);
    };

    // Block frappe.model.set_value on this document
    const orig_model_set_value = frappe.model.set_value;
    frappe.model.set_value = function (doctype, name, fieldname, value, opts) {
        try {
            if (
                cur_frm &&
                cur_frm.doc &&
                cur_frm.doc.doctype === doctype &&
                cur_frm.doc.name === name &&
                cur_frm.doc.docstatus !== 0
            ) {
                return Promise.resolve();
            }
        } catch (e) {}
        return orig_model_set_value.apply(this, arguments);
    };
}


// Helper: Always hide default Print/Email buttons
function always_hide_print_and_email(frm) {
    frappe.after_ajax(() => {
        setTimeout(() => {
            const print_titles = ["Print", "طباعة"];
            const email_titles = ["Email", "البريد الإلكتروني"];

            if (frm.page && frm.page.wrapper) {
                print_titles.concat(email_titles).forEach((title) => {
                    frm.page.wrapper
                        .find(`.btn[data-original-title="${title}"], .btn[data-label="${title}"]`)
                        .not('[data-label="طباعة عرض السعر"]') // Exclude "طباعة عرض السعر"
                        .not('[data-label="إرسال البريد الإلكتروني"]') // Exclude "إرسال البريد الإلكتروني"
                        .not('[data-label="إرسال واتساب"]') // Exclude "إرسال واتساب"
                        .hide(); // Hide other buttons
                });
            }
        }, 300);
    });
}


// Helper: Check if workflow state is valid
function is_valid_state(frm) {
    const valid_states = ["Supervisor Approved", "موافقه المشرف"];
    const state = (frm.doc.workflow_state || "").trim();
    return valid_states.includes(state);
}


// Helper: Add custom Print button
function add_custom_print_button(frm) {
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

                const url = `/api/method/frappe.utils.print_format.download_pdf` +
                    `?doctype=${encodeURIComponent(frm.doctype)}` +
                    `&name=${encodeURIComponent(frm.doc.name)}` +
                    `&format=${encodeURIComponent(template.print_format)}` +
                    `&letterhead=${encodeURIComponent(frm.doc.letter_head || "None")}` +
                    `&no_letterhead=0` +
                    `&_lang=ar`;

                window.open(url, '_blank');
            });
    });
}


// Helper: Add custom Email button
function add_custom_email_button(frm) {
    frm.add_custom_button('إرسال البريد الإلكتروني', function () {
        const send_email = (email) => {
            frappe.call({
                method: "tst.email.send_quotation_with_signature",
                args: {
                    quotation_name: frm.doc.name,
                    recipient: email
                },
                callback(r) {
                    if (!r.exc) frappe.msgprint('تم إرسال البريد الإلكتروني بنجاح!');
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
            frappe.prompt(
                [{ fieldname: 'recipient', label: 'البريد الإلكتروني للمستلم', fieldtype: 'Data', reqd: 1 }],
                (values) => send_email(values.recipient),
                'إدخال البريد الإلكتروني',
                'إرسال'
            );
        }
    });
}


// Helper: Add custom WhatsApp button
function add_custom_whatsapp_button(frm) {
    frm.add_custom_button('إرسال واتساب', function () {
        frappe.call({
            method: "tst.whatsapp.create_wh_massage_with_attachment",
            args: {
                quotation_name: frm.doc.name,
                doctype: frm.doctype
            },
            callback(r) {
                if (!r.exc) frappe.msgprint(r.message.msg || 'تم إنشاء رسالة الواتساب بنجاح مع المرفق.');
            },
            error() {
                frappe.msgprint('حدث خطأ أثناء إنشاء رسالة الواتساب أو إرفاق الملف.');
            },
            freeze: true,
            freeze_message: 'يرجى الانتظار حتى يتم إرسال الرسالة...'
        });
    });
}


// Helper: Update fields from Lead
function update_from_lead(frm) {
    if (frm.doc.docstatus !== 0 || frm.doc.quotation_to !== "Lead" || !frm.doc.party_name) return;

    frappe.db.get_doc("Lead", frm.doc.party_name).then(lead => {
        if (!lead || !lead.custom_customer_name) return;

        const updates = {};
        if (frm.doc.customer_name !== lead.custom_customer_name) {
            updates.customer_name = lead.custom_customer_name;
        }
        if (frm.doc.title !== lead.custom_customer_name) {
            updates.title = lead.custom_customer_name;
        }

        // Only update if there are changes
        if (Object.keys(updates).length) {
            frm.set_value(updates);
        }
    });
}


// Helper: Clear and fetch template items
function clear_and_fetch_template_items(frm) {
    frm.clear_table('items');
    frm.refresh_field('items');

    if (!frm.doc.custom_quotation_templet) return;

    frappe.call({
    method: "tst.triggers.selling.quotation.quotation.get_quotation_template_items",
    args: { template_name: frm.doc.custom_quotation_templet },
    callback(r) {
        if (r.message && Array.isArray(r.message) && r.message.length > 0) {
            // Clear existing items from the table to prevent duplicates
            frm.clear_table("items");

            // Loop through the fetched items and add them to the child table
            r.message.forEach(item => {
                if (item.item_code) {
                    const child = frm.add_child("items");
                    child.item_code = item.item_code;
                    child.item_name = item.item_name;
                    child.uom = item.uom;
                }
            });

            // Refresh the field to update the UI with the added items
            frm.refresh_field('items');
        } else {
            // Show a message if no items are found in the selected template
            frappe.msgprint({
                title: __('No Items Found'),
                message: __('لم يتم العثور على عناصر في قالب عرض السعر المحدد.'),
                indicator: 'orange'
            });
        }
    },
    error: (err) => {
        // Handle any server-side errors
        frappe.msgprint({
            title: __('Error'),
            message: __('An error occurred while fetching the quotation template items.'),
            indicator: 'red'
        });
        console.error(err); // Log the error for debugging
    }
});
}


// Helper: Handle "Add to Item Table" action
async function handle_custom_add_to_item_table(frm) {
    if (frm.doc.docstatus !== 0) {
        frappe.msgprint(__('هذه التسعيرة ليست في حالة المسودة، لا يمكن إضافة عناصر.'));
        return;
    }

    const bundle = frm.doc.custom_subscription_bundle;
    const months = Number(frm.doc.custom_no_of_months);
    const monthly_rate = Number(frm.doc.custom_monthly_rate);
    const qty = Number(frm.doc.custom_quantity) || 1;

    // Validate required fields
    if (!bundle || !months || !monthly_rate || months <= 0 || monthly_rate <= 0 || qty <= 0) {
        frappe.msgprint(__('الرجاء اختيار جميع الحقول: حزمة المنتج، عدد الأشهر، والسعر الشهري.'));
        return;
    }

    try {
        // Fetch the Product Bundle details
        const bundle_details = await frappe.call({
            method: "frappe.client.get",
            args: { doctype: "Product Bundle", name: bundle }
        });

        const bundle_data = bundle_details.message;

        // Ensure the bundle has valid items
        const bundle_items = (bundle_data.items || []).filter(i => i.item_code);
        if (bundle_items.length === 0) {
            frappe.msgprint(__('لا توجد عناصر في حزمة المنتج المحددة.'));
            return;
        }

        // Arabic months text
        const months_text = months === 1 ? "شهر واحد" : months === 2 ? "شهرين" : `${months} أشهر`;
        const custom_subscription_data = `اشتراك لمدة ${months_text} في ${bundle_data.description || bundle}`;

        // Check for duplicates
        const existing_items = frm.doc.items || [];
        const duplicate_item = existing_items.find(item => {
            return item.custom_subscription_bundle === bundle || item.custom_subscription_data === custom_subscription_data;
        });

        if (duplicate_item) {
            frappe.msgprint(__('لا يمكن إضافة نفس حزمة المنتج أو بيانات الاشتراك الموجودة بالفعل في جدول العناصر.'));
            return;
        }

        // Process each item in the Product Bundle
        for (let b_item of bundle_items) {
            const item_code = b_item.item_code;

            // Fetch item details
            const details = await get_item_details(item_code);

            // Skip invalid items
            if (!item_code || !details.item_name || !details.uom) {
                frappe.msgprint(__('لا يمكن إضافة العنصر بسبب بيانات ناقصة للكود: {0}', [item_code || '(بدون كود)']));
                continue;
            }

            const rate_percent = parseFloat(b_item.custom_rate_percent || b_item.rate_percent || 0) || 0;
            const calculated_rate = months * monthly_rate * (rate_percent / 100);

            // Add the item to the child table
            frm.add_child('items', {
                item_code,
                item_name: details.item_name,
                uom: details.uom,
                qty,
                rate: calculated_rate,
                custom_subscription: 1,
                custom_subscription_data,
                custom_subscription_bundle: bundle,
                description: `${b_item.description || ''} لعدد اجهزة ${qty}`
            });
        }

        // Clear input fields
        frm.set_value({
            custom_subscription_bundle: null,
            custom_no_of_months: null,
            custom_monthly_rate: null,
            custom_quantity: null
        });

        // Refresh the child table
        frm.refresh_field('items');

        // Automatically save the form
        await frm.save();

        // Notify the user of successful addition and save
        frappe.msgprint(__('تمت إضافة العناصر وحفظ المستند بنجاح.'));
    } catch (error) {
        // Handle errors gracefully
        frappe.msgprint(__('حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'));
        console.error(error);
    }
}

// Helper to fetch item details
const get_item_details = async (item_code) => {
    try {
        // Ensure `item_code` is valid
        if (!item_code) {
            console.error('Missing item_code');
            return {
                item_name: __('اسم غير معروف'),
                uom: __('وحدة غير معروفة')
            };
        }

        // Fetch the full item document
        const item_doc = await frappe.db.get_doc('Item', item_code);

        // Check and return the required fields with fallbacks
        return {
            item_name: item_doc?.item_name || __('اسم غير معروف'),
            uom: item_doc?.stock_uom || __('وحدة غير معروفة')
        };
    } catch (error) {
        // Handle fetch errors
        console.error(`Error fetching item details for ${item_code}:`, error);

        // Return fallback values
        return {
            item_name: __('اسم غير معروف'),
            uom: __('وحدة غير معروفة')
        };
    }
};