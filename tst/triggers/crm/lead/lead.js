frappe.ui.form.on('Lead', {
    refresh: function(frm) {
        // Remove all custom buttons except "Customer" and "Quotation"
        setTimeout(function() {
            // Remove unwanted buttons after ERPNext adds them
            frm.remove_custom_button(__('Opportunity'), __('Create'));
            frm.remove_custom_button(__('Prospect'), __('Create'));
            frm.remove_custom_button(__('Add to Prospect'), __('Action'));

            // Optionally, re-add only the two you want,
            // in case ERPNext's logic doesn't show them in some cases:
            if (!frm.is_new() && frm.doc.__onload && !frm.doc.__onload.is_customer) {
                // Remove first to avoid duplicates
                frm.remove_custom_button(__('Customer'), __('Create'));
                frm.remove_custom_button(__('Quotation'), __('Create'));

                frm.add_custom_button(__('Customer'), function() {
                    frappe.model.open_mapped_doc({
                        method: "erpnext.crm.doctype.lead.lead.make_customer",
                        frm: frm
                    });
                }, __('Create'));

                frm.add_custom_button(__('Quotation'), function() {
                    frappe.model.open_mapped_doc({
                        method: "erpnext.crm.doctype.lead.lead.make_quotation",
                        frm: frm
                    });
                }, __('Create'));
            }
        }, 250); // Wait 250ms for ERPNext to add its buttons
    }
});




frappe.ui.form.on('Lead', {
    validate: function(frm) {
        // Only validate if Customer Analysis tab is completed
        if (isTabCompleted(frm, "Customer Information")) {
            // Validate custom_tax_id only if Lead Type is "Company" AND value is entered
            if (frm.doc.type === "Company" ) {
                if (!/^\d{15}$/.test(frm.doc.custom_tax_id)) {
                    frappe.throw(__('Custom Tax ID must be exactly 15 digits for Company Leads.'));
                }
            }
            // Validate custom_national_id only if Lead Type is "Individual" AND value is entered
            if (frm.doc.type === "Individual" ) {
                if (!/^\d{10}$/.test(frm.doc.custom_national_id)) {
                    frappe.throw(__('Custom National ID must be exactly 10 digits for Individual Leads.'));
                }
            }
        }
    }
});

// Make sure isTabCompleted is globally defined or included above this block.

frappe.ui.form.on('Lead', {
    custom_city1: function(frm){ 
        apply_filter_to_field_district(frm)
    },
    mobile_no:function(frm){
        is_valid_mobile_no(frm)
    },
    onload: function(frm) {
        // Hide Tab 2 and Tab 3 
        frm.$wrapper.find("[data-fieldname='custom_tab_6']").hide();
        frm.$wrapper.find("[data-fieldname='custom_tab_7']").hide();
    },

    after_save: function(frm) {
        // Reload the form after save to get the latest doc state
        frm.reload_doc()
    }
});
function show_action_button(frm) {
    if (!isTabCompleted(frm, "Customer Information")) {
        frm.$wrapper.find("[data-label='Action']").hide()
        frm.$wrapper.find("[data-label='Create'").hide()
    }
    else{
        frm.$wrapper.find("[data-label = 'Action']").show()
        frm.$wrapper.find("[data-label = 'Create']").show()
    }
}

function show_tabs_based_on_completion(frm) {
    if (!frm.is_new()) {
        // Check if Tab 1 is completed and show Tab 2
        if (isTabCompleted(frm, "Company Information")) {
            frm.$wrapper.find("[data-fieldname='custom_tab_6']").show();
        }

        // Check if Tab 2 is completed and show Tab 3
        if (isTabCompleted(frm, "Customer Analysis")) {
            if (frm.doc.type === "Company") {
                frm.set_df_property("custom_tax_id", "reqd", 1);
                frm.set_df_property("custom_national_id", "reqd", 0);
            } else if (frm.doc.type === "Individual") {
                frm.set_df_property("custom_national_id", "reqd", 1);
                frm.set_df_property("custom_tax_id", "reqd", 0);
            }

            frm.$wrapper.find("[data-fieldname='custom_tab_7']").show();
        }
    }
}

// Utility function to check if all fields in a specific tab are filled
function isTabCompleted(frm, tabName) {
    // Get all fields associated with the specified tab
    let tabFields = getTabFields(frm, tabName);
    let optional_fields = ["email_id","custom_competitor_company_name","custom_tax_certificate","custom_national_address","custom_tax_registration","custom_tax_id","custom_national_id"]
    
    // Iterate over all the fields in the tab and check if they are filled
    for (let fieldname of tabFields) {
        if ((!frm.doc[fieldname] || (fieldname == "custom_car_details" && frm.doc[fieldname].length == 0)) && (!optional_fields.includes(fieldname))){
            
            return false; // Return false if any field is empty
        }
    }
    return true; // Return true if all fields in the tab are filled
}

// Function to dynamically retrieve all fields in a specified tab
function getTabFields(frm, tabLabel) {
    let fields = [];
    let meta = frappe.get_meta(frm.doc.doctype);
    let found = false;

    for (let i = 0; i < meta.fields.length; i++) {
        let field = meta.fields[i];

        // Look for the Section Break with the given label (i.e., tab name)
        if (field.fieldtype === "Tab Break" && field.label === tabLabel) {
            found = true;
            continue;
        }

        // If we've found the tab, collect all fields until the next Section Break
        if (found) {

            if (field.fieldtype === "Tab Break") {
                break;  // Stop at the next section/tab
            }
            // Skip layout-only fields like Column Break and Section Break
            if (["Column Break", "Section Break"].includes(field.fieldtype)) {
                continue;
            }
            fields.push(field.fieldname);  // Collect fieldname
        }
    }

    return fields;
}


function apply_filter_to_field_district(frm) {
    // get district of selected city
    frm.fields_dict["custom_district"].get_query = function (doc) {
        return {
            filters: [["District", "city", "=", frm.doc.custom_city1]],
        };
    };
}


function is_valid_mobile_no(frm){
    const mobile = frm.doc.mobile_no?.trim() || "";
    const field = frm.fields_dict.mobile_no.$wrapper.find('input');

    // Validation
    const isDigitsOnly = /^\d+$/.test(mobile);
    const isTenDigits = mobile.length === 10;

    if (isDigitsOnly && isTenDigits) {
        // Valid: green border
        field.css('border-color', 'green');
    } else {
        // Invalid: red border
        field.css('border-color', 'red');
    }
}