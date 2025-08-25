

function clean_custom_buttons(frm) {
    setTimeout(function () {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
        frm.remove_custom_button(__('Customer'), __('Create'));
    }, 250);
}

function add_make_quotation_button(frm) {
    // Remove default Quotation button under Create
    frm.remove_custom_button(__('Quotation'), __('Create'));

    const has_tax_info = frm.doc.custom_tax_id && frm.doc.custom_cr_number && frm.doc.company_name;
    const has_national_info = frm.doc.custom_national_id && frm.doc.company_name;

    // Add your custom Quotation button if conditions met
    if ((has_tax_info || has_national_info) && isTabCompleted(frm, "Customer Information")) {
        frm.add_custom_button(__('Quotation'), function () {
            frappe.model.open_mapped_doc({
                method: "erpnext.crm.doctype.lead.lead.make_quotation",
                frm: frm
            });
        }, __('Create'));
    }

    // Add another Quotation button, hidden by default
    let hiddenBtn = frm.add_custom_button(__(' Quotation'), function () {
        frappe.model.open_mapped_doc({
            method: "erpnext.crm.doctype.lead.lead.make_quotation",
            frm: frm
        });
    }, __('Create'));

    // Hide this button initially
    if (hiddenBtn) {
        hiddenBtn.toggle(false);
    }

    // You can later show it like:
    // hiddenBtn.toggle(true);
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

// === Utility: Check if All Tabs are Completed ===

function areAllTabsCompleted(frm) {
    const tabsToCheck = ["Company Information", "Customer Analysis"];
    return tabsToCheck.every(tab => isTabCompleted(frm, tab));
}

// === Utility: Hide/Show Tabs by Fieldname ===
function hide_tab(frm, tab_fieldname) {
    const $fieldWrapper = frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`);
    if ($fieldWrapper.length) $fieldWrapper.hide();
}

function show_tab(frm, tab_fieldname) {
    const $fieldWrapper = frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`);
    if ($fieldWrapper.length) $fieldWrapper.show();
}

// === Utility: Hide Specific Menu Items ===
function hide_menu_items() {
    const menuItemsToHide = [
        "Create%20%3E%20Opportunity",
        "Create%20%3E%20Quotation",
        "Create%20%3E%20Prospect",
        "Action%20%3E%20Add%20to%20Prospect",
        "Create%20%3E%20Customer"
    ];

    const observer = new MutationObserver(() => {
        let allHidden = true;
        menuItemsToHide.forEach(dataLabel => {
            const menuItem = document.querySelector(`[data-label="${dataLabel}"]`);
            if (menuItem) {
                menuItem.style.display = 'none';
            } else {
                allHidden = false;
            }
        });

        if (allHidden) observer.disconnect(); // Stop observing once all items are hidden
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// === Utility: Toggle "Create" Dropdown Button Visibility ===
function toggle_create_dropdown(frm) {
    const tax_id = (frm.doc.custom_tax_id || '').trim();
    const cr_number = (frm.doc.custom_cr_number || '').trim();
    const national_id = (frm.doc.custom_national_id || '').trim();
    const company_name = (frm.doc.company_name || '').trim();

    const show_button = (tax_id && cr_number && company_name) || (national_id && company_name);

    const $create_btns = frm.$wrapper
        .find('button.btn.ellipsis')
        .filter(function () {
            return $(this).text().trim().startsWith("Create");
        });

    if (show_button) {
        $create_btns.show();
    } else {
        $create_btns.hide();
    }
}

// === Utility: Bind Field Change Events to Toggle "Create" Dropdown ===
function bind_create_dropdown_watchers(frm) {
    const bind = fieldname => {
        if (frm.fields_dict[fieldname] && frm.fields_dict[fieldname].$input) {
            frm.fields_dict[fieldname].$input.on('input', () => toggle_create_dropdown(frm));
        }
    };
    ["custom_tax_id", "custom_cr_number", "custom_national_id", "company_name"].forEach(bind);
}

// === Add Custom "Create Lead Visit" Button ===
function add_create_lead_visit_button(frm) {
    if (frm.doc.name && !frm.doc.__islocal) {
        frm.add_custom_button(__('انشاء زيارة'), () => {
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
                                position => {
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
                                    }).then(doc => {
                                        frappe.msgprint(__('تم إنشاء الزيارة بنجاح!'));
                                        frappe.set_route('Form', 'Lead Visit', doc.name);
                                    });
                                },
                                error => {
                                    const errorMessages = {
                                        1: __('تم رفض إذن الموقع. يرجى السماح بالوصول إلى الموقع.'),
                                        2: __('معلومات الموقع غير متوفرة.'),
                                        3: __('انتهت مهلة الحصول على الموقع.'),
                                    };
                                    frappe.throw(errorMessages[error.code] || __('حدث خطأ غير معروف أثناء الحصول على الموقع.'));
                                },
                                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
                        }).then(doc => {
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

// === Utility: Handle Tab Visibility Based on Completion ===
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

// === Utility: Check if a Tab Is Completed ===
function isTabCompleted(frm, tabLabel) {
    const tabFields = getTabFields(frm, tabLabel);
    const optionalFields = ["email_id", "custom_tax_registration"];

    for (const fieldname of tabFields) {
        if (optionalFields.includes(fieldname)) continue;

        const field = frm.fields_dict[fieldname];

        if (field && field.df.fieldtype === "Table") {
            if (!frm.doc[fieldname] || frm.doc[fieldname].length === 0) return false;
        } else if (!frm.doc[fieldname] || frm.doc[fieldname] === "") {
            return false;
        }
    }
    return true;
}

// === Utility: Get Fields in a Tab ===
function getTabFields(frm, tabLabel) {
    const fields = [];
    const meta = frappe.get_meta(frm.doc.doctype);
    let found = false;

    for (const field of meta.fields) {
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
        hide_menu_items(frm);
        fetch_and_set_location(frm);
        toggle_create_dropdown(frm);
        bind_create_dropdown_watchers(frm);
    },

    custom_tax_id: function(frm) {
        toggle_create_dropdown(frm);
        frm.set_df_property("custom_cr_number", "reqd", 0);
        frm.set_df_property("custom_tax_id", "reqd", 1);
    },

    custom_cr_number: function(frm) {
        toggle_create_dropdown(frm);
        frm.set_df_property("custom_tax_id", "reqd", 0);
        frm.set_df_property("custom_cr_number", "reqd", 1);
    },

    custom_national_id: function(frm) {
        toggle_create_dropdown(frm);
    },

    company_name: function(frm) {
        toggle_create_dropdown(frm);
    },

    before_save: function(frm) {
        if (frm.doc.custom_latitude == 0 || frm.doc.custom_longitude == 0) {
            frm.set_value("custom_latitude", null);
            frm.set_value("custom_longitude", null);
        }
        if (frm.doc.custom_cr_number && !frm.doc.custom_tax_id) {
            frm.set_df_property("custom_tax_id", "reqd", 0);
            frm.set_df_property("custom_tax_id", "hidden", 1);
        }
        else if (frm.doc.custom_tax_id && !frm.doc.custom_cr_number) {
            frm.set_df_property("custom_cr_number", "reqd", 0);
            frm.set_df_property("custom_cr_number", "hidden", 1);
        }
    },

    validate: function(frm) {
        fetch_and_set_location(frm);
        if (frm.doc.type === "Company") {
            if (frm.doc.custom_cr_number && !/^\d{10}$/.test(frm.doc.custom_cr_number)) {
                frappe.throw(__('رقم السجل التجاري يجب أن يكون مكوناً من 10 أرقام بالضبط.'));
            }
            if (frm.doc.custom_tax_id && !/^\d{15}$/.test(frm.doc.custom_tax_id)) {
                frappe.throw(__('الرقم الضريبي يجب أن يكون مكوناً من 15 رقماً بالضبط.'));
            }
        }
        else if (frm.doc.type === "Individual") {
            if (frm.doc.custom_national_id && !/^\d{10}$/.test(frm.doc.custom_national_id)) {
                frappe.throw(__('رقم الهوية الوطنية يجب أن يكون مكوناً من 10 أرقام بالضبط.'));
            }
        }
    }
});

function fetch_and_set_location(frm) {
    console.log("Fetching location...");

    // Log the current values of latitude and longitude for debugging
    console.log("Document Latitude:", frm.doc.custom_latitude);
    console.log("Document Longitude:", frm.doc.custom_longitude);

    // Explicitly check if the document is new or if coordinates are invalid
    const is_new_document = frm.is_new();
    const has_valid_coordinates = (
        frm.doc.custom_latitude !== undefined &&
        frm.doc.custom_longitude !== undefined &&
        frm.doc.custom_latitude !== null &&
        frm.doc.custom_longitude !== null &&
        frm.doc.custom_latitude !== 0 &&
        frm.doc.custom_longitude !== 0
    );

    // Skip fetching location if the document is not new and coordinates are valid
    if (!is_new_document && has_valid_coordinates) {
        console.log("Location already set or not a new document.");
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                console.log("Position fetched from browser:");
                console.log("Browser Latitude:", position.coords.latitude);
                console.log("Browser Longitude:", position.coords.longitude);

                // Ensure valid coordinates are available
                if (position.coords.latitude && position.coords.longitude) {
                    // Save the values directly to the database and reload the page
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: {
                            doctype: frm.doctype,
                            name: frm.docname,
                            fieldname: {
                                custom_latitude: position.coords.latitude,
                                custom_longitude: position.coords.longitude
                            }
                        },
                        callback: function (response) {
                            if (!response.exc) {
                                console.log("Location updated in the database. Reloading form...");
                                frm.reload_doc(); // Reload the document to reflect changes
                            } else {
                                frappe.msgprint(__('An error occurred while updating the location.'));
                                console.error("Error updating location:", response.exc);
                            }
                        }
                    });
                } else {
                    console.error("Invalid coordinates received from browser:", position.coords);
                    frappe.msgprint(__('Unable to fetch valid latitude and longitude.'));
                }
            },
            function (error) {
                console.error("Geolocation error:", error);
                const errorMessages = {
                    1: __('Permission to access location was denied. Please allow access.'),
                    2: __('Location information is unavailable.'),
                    3: __('The request to get location timed out.')
                };
                frappe.msgprint(errorMessages[error.code] || __('An unknown error occurred while fetching the location.'));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        console.error("Geolocation not supported by browser.");
        frappe.msgprint(__('Geolocation is not supported by your browser.'));
    }
}