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

  custom_add_to_item_table: async function(frm) {
    // Guard: only allow on Draft
    if (frm.doc.docstatus !== 0) {
      frappe.msgprint(__('This Quotation is not in Draft. You cannot add items.'));
      return;
    }

    const bundle = frm.doc.custom_subscription_bundle;
    const months = Number(frm.doc.custom_no_of_months);
    const monthly_rate = Number(frm.doc.custom_monthly_rate);

    if (!bundle || !months || !monthly_rate) {
      frappe.msgprint(__('Please select all fields: Product Bundle, No of Months, and Monthly Rate'));
      return;
    }

    frappe.call({
      method: "frappe.client.get",
      args: {
        doctype: "Product Bundle",
        name: bundle
      },
      callback: async function(r) {
        if (!r.message) {
          frappe.msgprint(__('No such Product Bundle found.'));
          return;
        }

        const bundle_items = (r.message.items || []).filter(i => i.item_code);
        const bundle_name = r.message.bundle_name || r.message.name || bundle;

        if (bundle_items.length === 0) {
          frappe.msgprint(__('No items found in the selected Product Bundle.'));
          return;
        }

        // Abort if any bundle item already exists in the items table
        const existing_codes = new Set((frm.doc.items || []).map(d => d.item_code).filter(Boolean));
        const incoming_codes = bundle_items.map(b => b.item_code);
        const duplicates = incoming_codes.filter(code => existing_codes.has(code));
        if (duplicates.length) {
          frappe.msgprint(__('These items already exist in the Items table: {0}. No items were added.', [duplicates.join(', ')]));
          return;
        }

        const custom_subscription_data = `Subscription for ${months} month${months === 1 ? '' : 's'} in ${bundle_name}`;

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

        // Track if we filled the first empty row
        let first_row_filled = false;

        for (let b_item of bundle_items) {
          const item_code = b_item.item_code;
          const details = await get_item_details(item_code, b_item.item_name, b_item.uom);

          if (!item_code || !details.item_name || !details.uom) {
            frappe.msgprint(__('Cannot add item: Missing Item Code, Item Name, or UOM for bundle row with item code: {0}', [item_code || '(no item code)']));
            continue;
          }

          const custom_rate_percent = parseFloat(b_item.custom_rate_percent ?? b_item.rate_percent ?? 0) || 0;
          const calculated_rate = months * monthly_rate * (custom_rate_percent / 100);

          // Check if the first row is empty and hasn't been filled yet
          const items = frm.doc.items || [];
          if (!first_row_filled && items.length > 0 && !items[0].item_code) {
            // Fill the first empty row
            frappe.model.set_value(items[0].doctype, items[0].name, 'item_code', item_code);
            frappe.model.set_value(items[0].doctype, items[0].name, 'item_name', details.item_name);
            frappe.model.set_value(items[0].doctype, items[0].name, 'uom', details.uom);
            frappe.model.set_value(items[0].doctype, items[0].name, 'qty', 1);
            frappe.model.set_value(items[0].doctype, items[0].name, 'rate', calculated_rate);
            frappe.model.set_value(items[0].doctype, items[0].name, 'custom_subscription', 1);
            frappe.model.set_value(items[0].doctype, items[0].name, 'custom_subscription_data', custom_subscription_data);
            frappe.model.set_value(items[0].doctype, items[0].name, 'description', b_item.description);
            first_row_filled = true;
          } else {
            // Add new row as usual
            frm.add_child('items', {
              item_code: item_code,
              item_name: details.item_name,
              uom: details.uom,
              qty: 1,
              rate: calculated_rate,
              custom_subscription: 1,
              custom_subscription_data: custom_subscription_data,
              description: b_item.description
            });
          }
        }

        frm.refresh_field('items');
        frappe.msgprint(__('All items from Product Bundle have been added to the quotation.'));
      }
    });
  }
});