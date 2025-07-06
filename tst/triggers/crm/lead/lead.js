// === Check if all tabs are completed ===
function areAllTabsCompleted(frm) {
    const tabsToCheck = ["Company Information", "Customer Analysis"]; // Add all relevant tab labels here
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

// === Utility: Hide "Create > Customer" button ===
function hide_menu_items() {
    const menuItemsToHide = [
        "Create%20%3E%20Opportunity", // Create > Opportunity
        "Create%20%3E%20Quotation",  // Create > Quotation
        "Create%20%3E%20Prospect",   // Create > Prospect
        "Action%20%3E%20Add%20to%20Prospect", // Action > Add to Prospect
        "Create%20%3E%20Customer" // Action > Add to Prospect
    ];

    const observer = new MutationObserver(() => {
        menuItemsToHide.forEach((dataLabel) => {
            const menuItem = document.querySelector(`[data-label="${dataLabel}"]`);
            if (menuItem) {
                menuItem.style.display = 'none'; // Hide the menu item
            }
        });
    });

    // Observe DOM for changes
    observer.observe(document.body, { childList: true, subtree: true });
}

function add_create_lead_visit_button(frm) {
    // Only add the button if the document is not new or local
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
                    // Hide the dialog after action
                    dialog.hide();

                    // Check if the visit type is "زيارة ميدانية" (Field Visit)
                    if (values.visit_type === __("زيارة ميدانية")) {
                        // Ensure Geolocation API is supported
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                function (position) {
                                    // Insert the Lead Visit record with mandatory location
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
                                    // Handle errors if geolocation fails
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
                                    frappe.throw(errorMessage); // Throw error to prevent record insertion
                                },
                                {
                                    enableHighAccuracy: true, // Request high accuracy if available
                                    timeout: 10000, // Timeout after 10 seconds
                                    maximumAge: 0 // Do not use cached location
                                }
                            );
                        } else {
                            frappe.throw(__('المتصفح لا يدعم خاصية تحديد الموقع الجغرافي.'));
                        }
                    } else {
                        // If visit type is "هاتف" (Phone), location is not required
                        frappe.db.insert({
                            doctype: 'Lead Visit',
                            lead: frm.doc.name,
                            visit_type: values.visit_type,
                            visit_date: frappe.datetime.now_date(),
                            latitude: null, // No location for phone visits
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
// === Utility: Add "Make Quotation" button ===
function add_make_quotation_button(frm) {
    // Always remove to prevent duplicates/misplacement
    frm.remove_custom_button(__('Quotation'), __('Create')); 

    // Only add if "Customer Information" tab is completed
    if (isTabCompleted(frm, "Customer Information")) {
        frm.add_custom_button(__('Quotation'), function() {
            // Your logic to make a Quotation
            frappe.model.open_mapped_doc({
                method: "erpnext.crm.doctype.lead.lead.make_quotation",
                frm: frm
            });
        }, __('Create'));
    }
}

// === Utility: Dynamically observe and clean buttons ===
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

// === Utility: Remove unwanted custom buttons ===
function clean_custom_buttons(frm) {
    setTimeout(function () {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
        frm.remove_custom_button(__('Customer'), __('Create'));
    }, 250);
}

// === Utility: Check if all fields in a tab are completed ===
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

// === Utility: Get all fields under a specific tab ===
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

// === Main Tab Logic: Handle visibility of tabs ===
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

// === Utility: Update the map based on latitude and longitude ===
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

// === Utility: Fetch and set geolocation ===
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
        add_make_quotation_button(frm);
        fetch_and_set_location(frm);
        hide_menu_items(frm);
    },
    refresh: function (frm) {
        handle_tab_visibility(frm);
        add_create_lead_visit_button(frm);
        add_make_quotation_button(frm);
        clean_custom_buttons(frm);
        observe_and_clean_buttons(frm);
        hide_menu_items(frm);
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
