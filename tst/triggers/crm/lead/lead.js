// Function to update the map in the custom_geolocation HTML field
function update_map(frm, latitude, longitude) {
    const mapHTML = `
        <div id="map" style="width: 100%; height: 300px;"></div>
        <script>
            // Initialize the map
            const map = L.map('map').setView([${latitude}, ${longitude}], 13);

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
            }).addTo(map);

            // Add a marker at the current location
            L.marker([${latitude}, ${longitude}]).addTo(map)
                .bindPopup('You are here!').openPopup();
        </script>
    `;

    // Dynamically set the map HTML in the custom_geolocation field
    frm.fields_dict.custom_geolocation.$wrapper.html(mapHTML);
}

// Main logic for Lead Doctype
frappe.ui.form.on('Lead', {
    // Trigger before saving the form
    before_save: function (frm) {
        return new Promise((resolve, reject) => {
            if (!frm.doc.custom_latitude || !frm.doc.custom_longitude) {
                if (navigator.geolocation) {
                    // Fetch the user's location
                    navigator.geolocation.getCurrentPosition(
                        function (position) {
                            // Set latitude and longitude
                            const latitude = position.coords.latitude;
                            const longitude = position.coords.longitude;

                            frm.set_value('custom_latitude', latitude);
                            frm.set_value('custom_longitude', longitude);

                            // Update the map
                            update_map(frm, latitude, longitude);

                            frappe.msgprint(__('Location fetched and set successfully!'));
                            resolve(); // Allow save to proceed
                        },
                        function (error) {
                            // Handle errors
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
                            reject(); // Block save
                        }
                    );
                } else {
                    frappe.msgprint(__('Geolocation is not supported by your browser.'));
                    reject(); // Block save
                }
            } else {
                // Update the map if latitude and longitude are already set
                update_map(frm, frm.doc.custom_latitude, frm.doc.custom_longitude);
                resolve(); // Proceed with save
            }
        });
    },

    // Refresh event: Update the map if latitude and longitude are set
    refresh: function (frm) {
        if (frm.doc.custom_latitude && frm.doc.custom_longitude) {
            update_map(frm, frm.doc.custom_latitude, frm.doc.custom_longitude);
        }

        add_create_lead_visit_button(frm); // Add custom button
        handle_tab_visibility(frm); // Handle tab visibility
        clean_custom_buttons(frm); // Clean unwanted buttons
    },

    // On form load: Hide all dependent tabs initially
    onload: function (frm) {
        hide_tab(frm, 'custom_tab_6');
        hide_tab(frm, 'custom_tab_7');
    },

    // Validate specific fields based on lead type
    validate: function (frm) {
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

    // Trigger actions on specific fields
    custom_city1: function (frm) {
        apply_filter_to_field_district(frm);
        handle_tab_visibility(frm);
    },
    mobile_no: function (frm) {
        is_valid_mobile_no(frm);
        handle_tab_visibility(frm);
    }
});

// Utility: Add "Create Lead Visit" button
function add_create_lead_visit_button(frm) {
    frm.add_custom_button(__('Create Lead Visit'), function () {
        const dialog = new frappe.ui.Dialog({
            title: __('Select Visit Type'),
            fields: [
                {
                    label: __('Visit Type'),
                    fieldname: 'visit_type',
                    fieldtype: 'Select',
                    options: ["", __('On Location'), __('Phone')],
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
                            address: `Lat: ${position.coords.latitude}, Long: ${position.coords.longitude}`
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

// Utility: Hide tab by fieldname
function hide_tab(frm, tab_fieldname) {
    frm.set_df_property(tab_fieldname, 'hidden', 1);
}

// Utility: Show tab by fieldname
function show_tab(frm, tab_fieldname) {
    frm.set_df_property(tab_fieldname, 'hidden', 0);
}

// Utility: Check if a tab is complete
function isTabCompleted(frm, tabLabel) {
    const tabFields = getTabFields(frm, tabLabel);
    const optionalFields = [
        "email_id",
        "custom_competitor_company_name",
        "custom_tax_certificate",
        "custom_national_address",
        "custom_tax_registration",
        "custom_tax_id",
        "custom_national_id"
    ];
    for (let fieldname of tabFields) {
        if (optionalFields.includes(fieldname)) continue;
        const field = frm.fields_dict[fieldname];
        if (field && field.df.fieldtype === "Table") {
            if (!frm.doc[fieldname] || frm.doc[fieldname].length === 0) return false;
        } else {
            if (!frm.doc[fieldname] || frm.doc[fieldname] === "") return false;
        }
    }
    return true;
}

// Utility: Get fields under a tab
function getTabFields(frm, tabLabel) {
    const fields = [];
    const meta = frappe.get_meta(frm.doc.doctype);
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

// Utility: Apply filter to the district based on city
function apply_filter_to_field_district(frm) {
    frm.fields_dict["custom_district"].get_query = function () {
        return {
            filters: [["District", "city", "=", frm.doc.custom_city1]],
        };
    };
}

// Utility: Validate mobile number format
function is_valid_mobile_no(frm) {
    const mobile = frm.doc.mobile_no?.trim() || "";
    const field = frm.fields_dict.mobile_no.$wrapper.find('input');
    const isDigitsOnly = /^\d+$/.test(mobile);
    const isTenDigits = mobile.length === 10;
    field.css('border-color', isDigitsOnly && isTenDigits ? 'green' : 'red');
}

// Utility: Remove unnecessary custom buttons
function clean_custom_buttons(frm) {
    setTimeout(function () {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
    }, 250);
}

// Utility: Handle tab visibility
function handle_tab_visibility(frm) {
    if (isTabCompleted(frm, "Company Information")) {
        show_tab(frm, 'custom_tab_6');
    } else {
        hide_tab(frm, 'custom_tab_6');
        hide_tab(frm, 'custom_tab_7');
        return;
    }
    if (isTabCompleted(frm, "Customer Analysis")) {
        show_tab(frm, 'custom_tab_7');
    } else {
        hide_tab(frm, 'custom_tab_7');
    }
}