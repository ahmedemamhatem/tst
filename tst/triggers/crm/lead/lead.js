frappe.provide("erpnext");
cur_frm.email_field = "email_id";

erpnext.LeadController = class LeadController extends frappe.ui.form.Controller {
    setup() {
        this.frm.make_methods = {
            // Removed "Customer" and "Opportunity"
            Quotation: this.make_quotation.bind(this),
        };

        // For avoiding integration issues.
        this.frm.set_df_property("first_name", "reqd", true);
    }

    onload() {
        this.frm.set_query("lead_owner", function (doc, cdt, cdn) {
            return { query: "frappe.core.doctype.user.user.user_query" };
        });

        // Call additional custom functions
        hide_tab(this.frm, 'custom_tab_6');
        hide_tab(this.frm, 'custom_tab_7');
        fetch_and_set_location(this.frm);
    }

    refresh() {
        var me = this;
        let doc = this.frm.doc;

        erpnext.toggle_naming_series();

        if (!this.frm.is_new() && doc.__onload && !doc.__onload.is_customer) {
            // Add only Quotation button from core functionality
            this.frm.add_custom_button(__("Quotation"), this.make_quotation.bind(this), __("Create"));

            // Add custom "Create Visit" button
            add_create_lead_visit_button(this.frm);
        }

        if (!this.frm.is_new()) {
            frappe.contacts.render_address_and_contact(this.frm);
        } else {
            frappe.contacts.clear_address_and_contact(this.frm);
        }

        // Custom button clean-up
        clean_custom_buttons(this.frm);
        observe_and_clean_buttons(this.frm);

        // Custom logic for hiding/showing tabs and buttons
        handle_tab_visibility(this.frm);
        hide_buttons_on_mobile(this.frm);
        hide_user_action_menu(this.frm);

        // Show/hide Action/Create buttons based on tab completion
        show_action_button(this.frm);

        // Update the map if latitude and longitude are set
        if (this.frm.doc.custom_latitude && this.frm.doc.custom_longitude) {
            update_map(this.frm, this.frm.doc.custom_latitude, this.frm.doc.custom_longitude);
        }

        this.show_notes();
        this.show_activities();
    }

    make_quotation() {
        frappe.model.open_mapped_doc({
            method: "erpnext.crm.doctype.lead.lead.make_quotation",
            frm: this.frm,
        });
    }

    show_notes() {
        if (this.frm.doc.docstatus == 1) return;

        const crm_notes = new erpnext.utils.CRMNotes({
            frm: this.frm,
            notes_wrapper: $(this.frm.fields_dict.notes_html.wrapper),
        });
        crm_notes.refresh();
    }

    show_activities() {
        if (this.frm.doc.docstatus == 1) return;

        const crm_activities = new erpnext.utils.CRMActivities({
            frm: this.frm,
            open_activities_wrapper: $(this.frm.fields_dict.open_activities_html.wrapper),
            all_activities_wrapper: $(this.frm.fields_dict.all_activities_html.wrapper),
            form_wrapper: $(this.frm.wrapper),
        });
        crm_activities.refresh();
    }
};

// Extend the core LeadController with your customizations
extend_cscript(cur_frm.cscript, new erpnext.LeadController({ frm: cur_frm }));

// === Utility: Hide Tab by fieldname ===
function hide_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).hide();
}

// === Utility: Show Tab by fieldname ===
function show_tab(frm, tab_fieldname) {
    frm.$wrapper.find(`[data-fieldname='${tab_fieldname}']`).show();
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

// === Utility: Clean up unwanted buttons ===
function clean_custom_buttons(frm) {
    setTimeout(function () {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
        frm.remove_custom_button(__('Customer'), __('Create'));
        frm.remove_custom_button('العميل', __('Create'));
    }, 250);
}

// === Utility: Observe and clean buttons dynamically ===
function observe_and_clean_buttons(frm) {
    const observer = new MutationObserver(() => {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
        frm.remove_custom_button(__('Add to Prospect'), __('Action'));
        frm.remove_custom_button(__('Customer'), __('Create'));
        frm.remove_custom_button('العميل', __('Create'));
        $('button:contains("Opportunity")').hide();
        $('button:contains("Prospect")').hide();
        $('button:contains("Add to Prospect")').hide();
        $('button:contains("Customer")').hide();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// === Utility: Hide buttons on mobile ===
function hide_buttons_on_mobile(frm) {
    if (window.innerWidth <= 768) {
        frm.remove_custom_button(__('Opportunity'), __('Create'));
        frm.remove_custom_button(__('Prospect'), __('Create'));
    }
}

// === Utility: Dynamically update the map ===
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

// === Utility: Fetch geolocation and update fields ===
function fetch_and_set_location(frm) {
    if (!frm.is_new() || (frm.doc.custom_latitude && frm.doc.custom_longitude)) {
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                frm.set_value('custom_latitude', position.coords.latitude);
                frm.set_value('custom_longitude', position.coords.longitude);
                update_map(frm, position.coords.latitude, position.coords.longitude);
            },
            function () {
                frappe.msgprint(__('Unable to fetch location.'));
            }
        );
    } else {
        frappe.msgprint(__('Geolocation is not supported by your browser.'));
    }
}