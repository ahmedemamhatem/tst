// === Utility: Hide Tab by fieldname ===
function hide_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).hide();
}

// === Utility: Show Tab by fieldname ===
function show_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).show();
}

// === Utility: Add "Create Visit" button ===
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

// === Utility: Add "Make Quotation" button ===
function add_make_quotation_button(frm) {
    frm.remove_custom_button(__('Quotation'), __('Create')); // Remove any duplicates
    frm.add_custom_button(__('Make Quotation'), function () {
        frappe.model.open_mapped_doc({
            method: "erpnext.crm.doctype.lead.lead.make_quotation", // Backend method to create Quotation
            frm: frm
        });
    }, __("Create")); // Group the button under the "Create" menu
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
    // Show "Customer Analysis" tab if "Company Information" is complete
    if (isTabCompleted(frm, "Company Information")) {
        show_tab(frm, "custom_tab_6");
    } else {
        hide_tab(frm, "custom_tab_6");
        hide_tab(frm, "custom_tab_7");
        return;
    }

    // Show "Customer Information" tab if "Customer Analysis" is complete
    if (isTabCompleted(frm, "Customer Analysis")) {
        show_tab(frm, "custom_tab_7");

        // If Lead Type is "Company", make specific fields mandatory
        if (frm.doc.type === "Company") {
            frm.set_df_property("company_name", "reqd", 1); // Make Trade Name mandatory
            frm.set_df_property("custom_cr_number", "reqd", 1); // Make CR Number mandatory
            frm.set_df_property("custom_tax_id", "reqd", 1); // Make Tax ID mandatory
        } else if (frm.doc.type === "Individual") {
            frm.set_df_property("custom_national_id", "reqd", 1); // Make National ID mandatory
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
                .bindPopup('You are here!').openPopup();
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
        }, function (error) {
            frappe.msgprint(__('Unable to fetch geolocation.'));
        });
    } else {
        frappe.msgprint(__('Geolocation is not supported by your browser.'));
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
    },
    refresh: function (frm) {
        handle_tab_visibility(frm);
        add_create_lead_visit_button(frm);
        add_make_quotation_button(frm);
        clean_custom_buttons(frm);
        observe_and_clean_buttons(frm);
    },
    validate: function (frm) {
        if (frm.doc.type === "Company" ) {
            if (frm.doc.custom_cr_number && !/^\d{10}$/.test(frm.doc.custom_cr_number)) {
                frappe.throw(__('CR Number must be exactly 10 digits.'));
            }
            if (!/^\d{15}$/.test(frm.doc.custom_tax_id)) {
                frappe.throw(__('Tax ID must be exactly 15 digits.'));
            }
        } else if (frm.doc.type === "Individual") {
            if (frm.doc.custom_national_id && !/^\d{10}$/.test(frm.doc.custom_national_id)) {
                frappe.throw(__('National ID must be exactly 10 digits.'));
            }
        }
    }
});