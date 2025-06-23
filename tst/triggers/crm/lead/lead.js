// === Utility: Hide Tab by fieldname ===
function hide_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).hide();
}

// === Utility: Show Tab by fieldname ===
function show_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).show();
}

// === Utility: Returns TRUE if all (non-optional) fields in a tab are filled ===
function isTabCompleted(frm, tabLabel) {
    let tabFields = getTabFields(frm, tabLabel);
    let optional_fields = [
        "email_id",
        "custom_competitor_company_name",
        "custom_tax_certificate",
        "custom_national_address",
        "custom_tax_registration",
        "custom_tax_id",
        "custom_national_id"
    ];
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

// === Utility: Get all fieldnames (excluding layout-only) under a given tab by label ===
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

// === Utility: Add "Create Lead Visit" button ===
function add_create_lead_visit_button(frm) {
    frm.add_custom_button(__('Create Visit'), function () {
        const dialog = new frappe.ui.Dialog({
            title: __('Select Visit Type'),
            fields: [
                {
                    label: __('Visit Type'),
                    fieldname: 'visit_type',
                    fieldtype: 'Select',
                    options: ["", __('زيارة ميدانيه'), __('هاتف')],
                    reqd: 1
                }
            ],
            primary_action_label: __('Create'),
            primary_action(values) {
                dialog.hide();

                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function (position) {
                        frappe.db.insert({
                            doctype: 'Lead Visit',
                            lead: frm.doc.name,
                            visit_type: values.visit_type,
                            visit_date: frappe.datetime.now_date(),
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            address: __('Lat: {0}, Long: {1}', [position.coords.latitude, position.coords.longitude])
                        }).then((doc) => {
                            frappe.msgprint(__('Lead Visit created successfully!'));
                            frappe.set_route('Form', 'Lead Visit', doc.name);
                        });
                    }, function () {
                        frappe.msgprint(__('Unable to fetch location. Please enable location access in your browser.'));
                    });
                } else {
                    frappe.msgprint(__('Geolocation is not supported by this browser.'));
                }
            }
        });

        dialog.show();
    });
}

// === Utility: Apply filter to district based on selected city ===
function apply_filter_to_field_district(frm) {
    frm.fields_dict["custom_district"].get_query = function (doc) {
        return {
            filters: [["District", "city", "=", frm.doc.custom_city1]],
        };
    };
}

// === Utility: Validate mobile number and color input border ===
function is_valid_mobile_no(frm) {
    const mobile = frm.doc.mobile_no?.trim() || "";
    const field = frm.fields_dict.mobile_no.$wrapper.find('input');
    const isDigitsOnly = /^\d+$/.test(mobile);
    const isTenDigits = mobile.length === 10;
    if (isDigitsOnly && isTenDigits) {
        field.css('border-color', 'green');
    } else {
        field.css('border-color', 'red');
    }
}

// === Utility: Remove unwanted custom buttons ===
function clean_custom_buttons(frm) {
    setTimeout(function () {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
        frm.remove_custom_button(__('Customer'), __('Create'));
        frm.remove_custom_button('العميل', __('Create'));
    }, 250);
}

// === Main tab logic: Show/hide tabs progressively ===
function handle_tab_visibility(frm) {
    // 1. Show Customer Analysis tab when Company Information is complete
    if (isTabCompleted(frm, "Company Information")) {
        show_tab(frm, 'custom_tab_6');
    } else {
        hide_tab(frm, 'custom_tab_6');
        hide_tab(frm, 'custom_tab_7');
        return;
    }
    // 2. Show Customer Information tab when Customer Analysis is complete
    if (isTabCompleted(frm, "Customer Analysis")) {
        if (frm.doc.type === "Company" && !frm.is_new()) {
            frm.set_df_property("custom_tax_id", "reqd", 1);
            frm.set_df_property("custom_cr_number", "reqd", 1);
            frm.set_df_property("company_name", "reqd", 1);
            frm.set_df_property("custom_national_id", "reqd", 0);
        } else if (frm.doc.type === "Individual" && !frm.is_new()) {
            frm.set_df_property("custom_national_id", "reqd", 1);
            frm.set_df_property("custom_tax_id", "reqd", 0);
        }
        show_tab(frm, 'custom_tab_7');
    } else {
        hide_tab(frm, 'custom_tab_7');
    }
}

// === OPTIONAL: Hide Action/Create buttons if Customer Information is incomplete ===
function show_action_button(frm) {
    if (!isTabCompleted(frm, "Customer Information")) {
        frm.$wrapper.find("[data-label='Action']").hide();
        frm.$wrapper.find("[data-label='Create']").hide();
    } else {
        frm.$wrapper.find("[data-label='Action']").show();
        frm.$wrapper.find("[data-label='Create']").show();
    }
}

// === Utility: Update the Map in the custom_geolocation HTML field ===
function update_map(frm, latitude, longitude) {
    const mapHTML = `
        <div id="map" style="width: 100%; height: 300px;"></div>
        <script>
            const map = L.map('map').setView([${latitude}, ${longitude}], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
            }).addTo(map);
            L.marker([${latitude}, ${longitude}]).addTo(map)
                .bindPopup('You are here!').openPopup();
        </script>
    `;

    frm.fields_dict.custom_geolocation.$wrapper.html(mapHTML);
}

// === Utility: Fetch Geolocation and Update Lat/Lon Fields ===
function fetch_and_set_location(frm) {
    if (!frm.is_new() || (frm.doc.custom_latitude && frm.doc.custom_longitude)) {
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                frm.set_value('custom_latitude', latitude);
                frm.set_value('custom_longitude', longitude);

                update_map(frm, latitude, longitude);
            },
            function (error) {
                let error_message = '';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        error_message = __('User denied the request for Geolocation.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        error_message = __('Location information is unavailable.');
                        break;
                    case error.TIMEOUT:
                        error_message = __('The request to get user location timed out.');
                        break;
                    default:
                        error_message = __('An unknown error occurred while fetching location.');
                        break;
                }
                frappe.msgprint(error_message);
            }
        );
    } else {
        frappe.msgprint(__('Geolocation is not supported by your browser.'));
    }
}

// === Main Form Events ===
frappe.ui.form.on('Lead', {
    onload: function(frm) {
        hide_tab(frm, 'custom_tab_6');
        hide_tab(frm, 'custom_tab_7');
        fetch_and_set_location(frm);
        add_create_lead_visit_button(frm);
    },
    refresh: function(frm) {
        clean_custom_buttons(frm);
        handle_tab_visibility(frm);
        show_action_button(frm);
        add_create_lead_visit_button(frm);
        if (frm.doc.custom_latitude && frm.doc.custom_longitude) {
            update_map(frm, frm.doc.custom_latitude, frm.doc.custom_longitude);
        }
    },
    after_save: function(frm) {
        frm.reload_doc();
    },
    validate: function(frm) {
        if (isTabCompleted(frm, "Customer Information")) {
            if (frm.doc.type === "Company") {
                if (!/^\d{15}$/.test(frm.doc.custom_tax_id)) {
                    frappe.throw(__('Custom Tax ID must be exactly 15 digits for Company Leads.'));
                }
            }
            if (frm.doc.type === "Individual") {
                if (!/^\d{10}$/.test(frm.doc.custom_national_id)) {
                    frappe.throw(__('Custom National ID must be exactly 10 digits for Individual Leads.'));
                }
            }
        }
    },
    custom_city1: function(frm) {
        apply_filter_to_field_district(frm);
        handle_tab_visibility(frm);
    },
    mobile_no: function(frm) {
        is_valid_mobile_no(frm);
        handle_tab_visibility(frm);
    }
});