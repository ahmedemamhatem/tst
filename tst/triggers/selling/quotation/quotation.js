frappe.ui.form.on('Quotation', {
  onload(frm) {
    // block frm.set_value on non-draft (silent)
    const orig_set_value = frm.set_value.bind(frm);
    frm.set_value = function(key, val) {
      if (frm.doc.docstatus !== 0) return Promise.resolve();
      return orig_set_value(key, val);
    };

    // block low-level model.set_value on this doc (silent)
    const orig_model_set_value = frappe.model.set_value;
    frappe.model.set_value = function(doctype, name, fieldname, value, opts) {
      try {
        if (cur_frm && cur_frm.doc &&
            cur_frm.doc.doctype === doctype &&
            cur_frm.doc.name === name &&
            cur_frm.doc.docstatus !== 0) {
          return Promise.resolve();
        }
      } catch (e) {}
      return orig_model_set_value.apply(this, arguments);
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
  // Only on drafts
  if (frm.doc.docstatus !== 0) return;

  if (frm.doc.quotation_to === "Lead" && frm.doc.party_name) {
    frappe.db.get_doc("Lead", frm.doc.party_name).then(lead => {
      if (!lead || !lead.custom_customer_name) return;

      const updates = {};
      if (frm.doc.customer_name !== lead.custom_customer_name) {
        updates.customer_name = lead.custom_customer_name;
      }
      if (frm.doc.title !== lead.custom_customer_name) {
        updates.title = lead.custom_customer_name;
      }
      if (Object.keys(updates).length) {
        frm.set_value(updates);
      }
      
    });
  }
}


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



frappe.ui.form.on('Quotation', {
  refresh(frm) {
    // Show the button only in Draft
    frm.toggle_display('custom_add_to_item_table', frm.doc.docstatus === 0);
  },

  custom_add_to_item_table: async function (frm) {
    // Guard: only allow on Draft
    if (frm.doc.docstatus !== 0) {
      frappe.msgprint(__('هذه التسعيرة ليست في حالة المسودة، لا يمكن إضافة عناصر.'));
      return;
    }

    const bundle = frm.doc.custom_subscription_bundle;
    const months = Number(frm.doc.custom_no_of_months);
    const monthly_rate = Number(frm.doc.custom_monthly_rate);
    const qty = Number(frm.doc.custom_quantity) || 1;

    // Ensure all required fields are filled
    if (!bundle || !months || !monthly_rate || months <= 0 || monthly_rate <= 0 || qty <= 0) {
      frappe.msgprint(__('الرجاء اختيار جميع الحقول: حزمة المنتج، عدد الأشهر، والسعر الشهري.'));
      return;
    }

    // Generate `custom_subscription_data`
    const bundle_desc = `${bundle} لمدة ${months} أشهر`;
    const custom_subscription_data = `اشتراك لمدة ${months} أشهر في ${bundle_desc}`;

    // Validate duplicates: `custom_subscription_bundle` OR `custom_subscription_data`
    const existing_items = frm.doc.items || [];
    const duplicate_item = existing_items.find(item => {
      return (
        item.custom_subscription_bundle === bundle || // Check if bundle is the same
        item.custom_subscription_data === custom_subscription_data // Check if subscription data is the same
      );
    });

    if (duplicate_item) {
      frappe.msgprint(__('لا يمكن إضافة نفس حزمة المنتج أو بيانات الاشتراك الموجودة بالفعل في جدول العناصر.'));
      return;
    }

    // Fetch the Product Bundle details
    try {
      const bundle_details = await frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Product Bundle",
          name: bundle
        }
      });

      if (!bundle_details.message) {
        frappe.msgprint(__('لم يتم العثور على حزمة المنتج.'));
        return;
      }

      let bundle_items = (bundle_details.message.items || []).filter(i => i.item_code);

      if (bundle_items.length === 0) {
        frappe.msgprint(__('لا توجد عناصر في حزمة المنتج المحددة.'));
        return;
      }

      // Arabic months text
      let months_text;
      if (months === 1) {
        months_text = "شهر واحد";
      } else if (months === 2) {
        months_text = "شهرين";
      } else {
        months_text = `${months} أشهر`;
      }

      // Arabic subscription description
      const custom_subscription_data = `اشتراك لمدة ${months_text} في ${bundle_desc}`;

      // Helper to get Item Name and UOM if missing
      const get_item_details = async (item_code, current_item_name, current_uom) => {
        let result = {
          item_name: current_item_name || "",
          uom: current_uom || ""
        };
        if (!item_code) return result;

        if (!result.item_name || !result.uom) {
          try {
            let resp = await frappe.db.get_doc('Item', item_code);
            if (!result.item_name) result.item_name = resp.item_name || "";
            if (!result.uom) result.uom = resp.stock_uom || "";
          } catch (e) {
            // leave as is if cannot fetch
          }
        }
        return result;
      };

      // Add items from the bundle
      for (let b_item of bundle_items) {
        const item_code = b_item.item_code;
        const details = await get_item_details(item_code, b_item.item_name, b_item.uom);

        if (!item_code || !details.item_name || !details.uom) {
          frappe.msgprint(__('لا يمكن إضافة العنصر: بيانات ناقصة للكود: {0}', [item_code || '(بدون كود)']));
          continue;
        }

        const custom_rate_percent = parseFloat(b_item.custom_rate_percent ?? b_item.rate_percent ?? 0) || 0;
        const calculated_rate = months * monthly_rate * (custom_rate_percent / 100);

        // Set description with the number of devices (qty)
        const item_description = `${b_item.description || ''} لعدد اجهزة ${qty}`;

        // Add new row
        frm.add_child('items', {
          item_code: item_code,
          item_name: details.item_name,
          uom: details.uom,
          qty: qty,
          rate: calculated_rate,
          custom_subscription: 1,
          custom_subscription_data: custom_subscription_data, // Add subscription data
          custom_subscription_bundle: bundle, // Add bundle
          description: item_description
        });
      }

      // Clear fields after adding items
      frm.set_value('custom_subscription_bundle', null);
      frm.set_value('custom_no_of_months', null);
      frm.set_value('custom_monthly_rate', null);
      frm.set_value('custom_quantity', null);

      // Refresh the items table and save the form
      frm.refresh_field('items');
      await frm.save(); // Automatically save the form

      frappe.msgprint(__('تمت إضافة جميع عناصر حزمة المنتج إلى التسعيرة وتم حفظ المستند.'));
    } catch (error) {
      frappe.msgprint(__('حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'));
      console.error(error);
    }
  }
});