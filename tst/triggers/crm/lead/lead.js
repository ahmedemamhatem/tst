function areAllTabsCompleted(frm) {
    const tabsToCheck = ["Company Information", "Customer Analysis"];
    return tabsToCheck.every(tab => isTabCompleted(frm, tab));
}

// === Utility: Hide Tab by fieldname ===
function hide_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).hide();
}

// === Utility: Show Tab by fieldname ===
function show_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).show();
}

// === Utility: Hide "Create > Customer" and other menu items ===
function hide_menu_items() {
    const menuItemsToHide = [
        "Create%20%3E%20Opportunity",
        "Create%20%3E%20Quotation",
        "Create%20%3E%20Prospect",
        "Action%20%3E%20Add%20to%20Prospect",
        "Create%20%3E%20Customer"
    ];

    const observer = new MutationObserver(() => {
        menuItemsToHide.forEach((dataLabel) => {
            const menuItem = document.querySelector(`[data-label="${dataLabel}"]`);
            if (menuItem) {
                menuItem.style.display = 'none';
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// === Utility: Hide/Show "Create" Dropdown Button by Field Logic ===
function toggle_create_dropdown(frm) {
    const tax_id = (frm.doc.custom_tax_id || '').trim();
    const cr_number = (frm.doc.custom_cr_number || '').trim();
    const national_id = (frm.doc.custom_national_id || '').trim();
    const company_name = (frm.doc.company_name || '').trim();

    const show_button = (tax_id && cr_number && company_name) || (national_id && company_name);

    // Find "Create" dropdown buttons in the primary form toolbar
    const $create_btns = $(frm.$wrapper)
        .find('button.btn.ellipsis')
        .filter(function() {
            return $(this).text().trim().startsWith("Create");
        });

    if (show_button) {
        $create_btns.show();
    } else {
        $create_btns.hide();
    }
}

// === Utility: Watch for field changes to toggle "Create" dropdown ===
function bind_create_dropdown_watchers(frm) {
    function bind(fieldname) {
        if (frm.fields_dict[fieldname] && frm.fields_dict[fieldname].$input) {
            frm.fields_dict[fieldname].$input.on('input', function() { toggle_create_dropdown(frm); });
        }
    }
    bind('custom_tax_id');
    bind('custom_cr_number');
    bind('custom_national_id');
    bind('company_name');
}

function add_create_lead_visit_button(frm) {
    if (frm.doc.name && !frm.doc.__islocal) {
        frm.add_custom_button(__('انشاء زيارة'), function () {
            const dialog = new frappe.ui.Dialog({
                title: __('اختر نوع الزيارة'),
                fields: [
                    {
                        label: __('نوع الزيارة'),
                        fieldname: 'visit_type',
                        fieldtype: 'Select',
                        options: ["", __("زيارة ميدانية"), __("هاتف")],
                        reqd: 1
                    }
                ],
                primary_action_label: __('إنشاء'),
                primary_action(values) {
                    dialog.hide();

                    if (values.visit_type === __("زيارة ميدانية")) {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                function (position) {
                                    frappe.db.insert({
                                        doctype: 'Lead Visit',
                                        lead: frm.doc.name,
                                        visit_type: values.visit_type,
                                        visit_date: frappe.datetime.now_date(),
                                        latitude: position.coords.latitude,
                                        longitude: position.coords.longitude,
                                        address: __('خط العرض: {0}, خط الطول: {1}', [
                                            position.coords.latitude,
                                            position.coords.longitude
                                        ])
                                    }).then((doc) => {
                                        frappe.msgprint(__('تم إنشاء الزيارة بنجاح!'));
                                        frappe.set_route('Form', 'Lead Visit', doc.name);
                                    });
                                },
                                function (error) {
                                    let errorMessage = '';
                                    switch (error.code) {
                                        case error.PERMISSION_DENIED:
                                            errorMessage = __('تم رفض إذن الموقع. يرجى السماح بالوصول إلى الموقع.');
                                            break;
                                        case error.POSITION_UNAVAILABLE:
                                            errorMessage = __('معلومات الموقع غير متوفرة.');
                                            break;
                                        case error.TIMEOUT:
                                            errorMessage = __('انتهت مهلة الحصول على الموقع.');
                                            break;
                                        default:
                                            errorMessage = __('حدث خطأ غير معروف أثناء الحصول على الموقع.');
                                    }
                                    frappe.throw(errorMessage);
                                },
                                {
                                    enableHighAccuracy: true,
                                    timeout: 10000,
                                    maximumAge: 0
                                }
                            );
                        } else {
                            frappe.throw(__('المتصفح لا يدعم خاصية تحديد الموقع الجغرافي.'));
                        }
                    } else {
                        frappe.db.insert({
                            doctype: 'Lead Visit',
                            lead: frm.doc.name,
                            visit_type: values.visit_type,
                            visit_date: frappe.datetime.now_date(),
                            latitude: null,
                            longitude: null,
                            address: __('زيارة هاتفية')
                        }).then((doc) => {
                            frappe.msgprint(__('تم إنشاء زيارة الهاتف بنجاح!'));
                            frappe.set_route('Form', 'Lead Visit', doc.name);
                            frm.reload_doc();
                        });
                    }
                }
            });

            dialog.show();
        });
    }
}

function toggle_inner_group_button(frm) {
    // Business logic: decide when to show or hide
    const tax_id      = (frm.doc.custom_tax_id || '').trim();
    const cr_number   = (frm.doc.custom_cr_number || '').trim();
    const national_id = (frm.doc.custom_national_id || '').trim();
    const company_name= (frm.doc.company_name || '').trim();

    const show_button = (tax_id && cr_number && company_name) || (national_id && company_name);

    function updateButtons() {
        document.querySelectorAll('.inner-group-button').forEach(btn => {
            // Remove visibility classes and inline style
            btn.classList.remove('hidden-by-script', 'show');
            btn.style.display = '';

            if (show_button) {
                // Show: default is visible, do nothing
            } else {
                btn.classList.add('hidden-by-script');
                btn.style.display = 'none'; // Fallback, always hides
            }
        });
    }

    updateButtons();

    // MutationObserver: handle buttons added dynamically
    if (!window._innerGroupButtonObserver) {
        window._innerGroupButtonObserver = new MutationObserver(updateButtons);
        window._innerGroupButtonObserver.observe(document.body, { childList: true, subtree: true });
    }
}

function add_make_quotation_button(frm) {
    frm.remove_custom_button(__('Quotation'), __('Create'));

    const has_tax_info = frm.doc.custom_tax_id && frm.doc.custom_cr_number && frm.doc.company_name;
    const has_national_info = frm.doc.custom_national_id && frm.doc.company_name;

    if ((has_tax_info || has_national_info) && isTabCompleted(frm, "Customer Information")) {
        frm.add_custom_button(__('Quotation'), function () {
            frappe.model.open_mapped_doc({
                method: "erpnext.crm.doctype.lead.lead.make_quotation",
                frm: frm
            });
        }, __('Create'));
    }
}

function observe_and_clean_buttons(frm) {
    const observer = new MutationObserver(() => {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
        frm.remove_custom_button(__('Customer'), __('Create'));
        $('button:contains("Opportunity")').hide();
        $('button:contains("Prospect")').hide();
        $('button:contains("Add to Prospect")').hide();
        $('button:contains("Customer")').hide();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function clean_custom_buttons(frm) {
    setTimeout(function () {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
        frm.remove_custom_button(__('Customer'), __('Create'));
    }, 250);
}

function isTabCompleted(frm, tabLabel) {
    let tabFields = getTabFields(frm, tabLabel);
    let optional_fields = ["email_id", "custom_tax_registration"];
    for (let fieldname of tabFields) {
        if (optional_fields.includes(fieldname)) continue;
        let field = frm.fields_dict[fieldname];
        if (field && field.df.fieldtype === "Table") {
            if (!frm.doc[fieldname] || frm.doc[fieldname].length === 0) return false;
        } else {
            if (!frm.doc[fieldname] || frm.doc[fieldname] === "") return false;
        }
    }
    return true;
}

function getTabFields(frm, tabLabel) {
    let fields = [];
    let meta = frappe.get_meta(frm.doc.doctype);
    let found = false;
    for (let field of meta.fields) {
        if (field.fieldtype === "Tab Break" && field.label === tabLabel) {
            found = true;
            continue;
        }
        if (found) {
            if (field.fieldtype === "Tab Break") break;
            if (["Column Break", "Section Break"].includes(field.fieldtype)) continue;
            fields.push(field.fieldname);
        }
    }
    return fields;
}

function handle_tab_visibility(frm) {
    if (isTabCompleted(frm, "Company Information")) {
        show_tab(frm, "custom_tab_6");
    } else {
        hide_tab(frm, "custom_tab_6");
        hide_tab(frm, "custom_tab_7");
        return;
    }

    if (isTabCompleted(frm, "Customer Analysis")) {
        show_tab(frm, "custom_tab_7");

        if (frm.doc.type === "Company") {
            frm.set_df_property("company_name", "reqd", 1);
            frm.set_df_property("custom_cr_number", "reqd", 1);
            frm.set_df_property("custom_tax_id", "reqd", 1);
        } else if (frm.doc.type === "Individual") {
            frm.set_df_property("custom_national_id", "reqd", 1);
            frm.set_df_property("custom_cr_number", "reqd", 0);
            frm.set_df_property("custom_tax_id", "reqd", 0);
            frm.set_df_property("company_name", "reqd", 0);
        }
    } else {
        hide_tab(frm, "custom_tab_7");
    }
}

function update_map(frm, latitude, longitude) {
    const mapHTML = `
        <div id="map" style="width: 100%; height: 300px;"></div>
        <script>
            const map = L.map('map').setView([${latitude}, ${longitude}], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data © OpenStreetMap contributors'
            }).addTo(map);
            L.marker([${latitude}, ${longitude}]).addTo(map)
                .bindPopup('${__("أنت هنا!")}').openPopup();
        </script>
    `;
    frm.fields_dict.custom_geolocation.$wrapper.html(mapHTML);
}

function fetch_and_set_location(frm) {
    if (!frm.is_new() || (frm.doc.custom_latitude && frm.doc.custom_longitude)) {
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            frm.set_value('custom_latitude', position.coords.latitude);
            frm.set_value('custom_longitude', position.coords.longitude);
            update_map(frm, position.coords.latitude, position.coords.longitude);
        }, function () {
            frappe.msgprint(__('غير قادر على جلب الموقع.'));
        });
    } else {
        frappe.msgprint(__('المتصفح لا يدعم خاصية تحديد الموقع الجغرافي.'));
    }
}

// === Main Form Events ===
frappe.ui.form.on('Lead', {
    onload: function (frm) {
        hide_tab(frm, "custom_tab_6");
        hide_tab(frm, "custom_tab_7");
        add_create_lead_visit_button(frm);
        toggle_inner_group_button(frm);
        add_make_quotation_button(frm);
        fetch_and_set_location(frm);
        hide_menu_items(frm);

        toggle_create_dropdown(frm);
        bind_create_dropdown_watchers(frm);
    },
    refresh: function (frm) {
        handle_tab_visibility(frm);
        add_create_lead_visit_button(frm);
        toggle_inner_group_button(frm);
        add_make_quotation_button(frm);
        clean_custom_buttons(frm);
        observe_and_clean_buttons(frm);
        hide_menu_items(frm);

        toggle_create_dropdown(frm);
        bind_create_dropdown_watchers(frm);
    },
    custom_tax_id: function(frm) {
        toggle_create_dropdown(frm);
    },
    custom_cr_number: function(frm) {
        toggle_create_dropdown(frm);
    },
    custom_national_id: function(frm) {
        toggle_create_dropdown(frm);
    },
    company_name: function(frm) {
        toggle_create_dropdown(frm);
    },
    custom_cr_number: function(frm) {
        frm.set_df_property("custom_tax_id", "reqd", 0);
        frm.set_df_property("custom_cr_number", "reqd", 1);
    },
    custom_tax_id: function(frm) {
        frm.set_df_property("custom_cr_number", "reqd", 0);
        frm.set_df_property("custom_tax_id", "reqd", 1);
    },
    validate: function (frm) {
        if (frm.doc.type === "Company") {
            if (frm.doc.custom_cr_number && !/^\d{10}$/.test(frm.doc.custom_cr_number)) {
                frappe.throw(__('رقم السجل التجاري يجب أن يكون مكوناً من 10 أرقام بالضبط.'));
            }
            if (frm.doc.custom_tax_id && !/^\d{15}$/.test(frm.doc.custom_tax_id)) {
                frappe.throw(__('الرقم الضريبي يجب أن يكون مكوناً من 15 رقماً بالضبط.'));
            }
        } else if (frm.doc.type === "Individual") {
            if (frm.doc.custom_national_id && !/^\d{10}$/.test(frm.doc.custom_national_id)) {
                frappe.throw(__('رقم الهوية الوطنية يجب أن يكون مكوناً من 10 أرقام بالضبط.'));
            }
        }
    }
});