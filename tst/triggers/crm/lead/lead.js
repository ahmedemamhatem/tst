frappe.ui.form.on('Lead', {
    custom_city1: function(frm){ 
        apply_filter_to_field_neighborhood(frm)
    },
    // This function is executed when the form is loaded
    onload: function(frm) {
        // Hide Tab 2 and Tab 3 
        frm.$wrapper.find("[data-fieldname='custom_tab_6']").hide();
        frm.$wrapper.find("[data-fieldname='custom_tab_7']").hide();
    },

    // This function is executed when the form is refreshed
    refresh: function(frm) {
        // If the document is not new, check whether the tabs should be revealed based on completion
        if (!frm.is_new()) {
            // Check if Tab 1 is completed and if so, show Tab 2
            if (isTabCompleted(frm, "Company Information")) {
                frm.$wrapper.find("[data-fieldname='custom_tab_6']").show();  // Show Tab 2
            }
            // Check if Tab 2 is completed and if so, show Tab 3
            if (isTabCompleted(frm, "Customer Analysis")) {
                if (frm.doc.type == "Company"){
                    frm.set_df_property("custom_tax_id","reqd",1)
                }
                if (frm.doc.type == "Individual"){
                    frm.set_df_property("custom_national_id","reqd",1)
                }
                frm.$wrapper.find("[data-fieldname='custom_tab_7']").show();   // Show Tab 3
            }
        }
    },

    // This function is executed after the form is saved
    after_save: function(frm) {
        // Check whether Tab 1 is completed after save, then reveal Tab 2
        if (isTabCompleted(frm, "Company Information")) {
           frm.$wrapper.find("[data-fieldname='custom_tab_6']").show();  // Show Tab 2
        }
        // Check whether Tab 2 is completed after save, then reveal Tab 3
        if (isTabCompleted(frm, "Customer Analysis")) {
            if (frm.doc.type == "Company"){
                frm.set_df_property("custom_tax_id","reqd",1)
            }
            if (frm.doc.type == "Individual"){
                frm.set_df_property("custom_national_id","reqd",1)
            }
            
            frm.$wrapper.find("[data-fieldname='custom_tab_7']").show();   // Show Tab 3
        }
    }
});

// Utility function to check if all fields in a specific tab are filled
function isTabCompleted(frm, tabName) {
    // Get all fields associated with the specified tab
    let tabFields = getTabFields(frm, tabName);
    
    // Iterate over all the fields in the tab and check if they are filled
    for (let fieldname of tabFields) {
        if (!frm.doc[fieldname] || (fieldname == "custom_car_details" && frm.doc[fieldname].length == 0)) {
            console.log(fieldname,frm.doc[fieldname])
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


function apply_filter_to_field_neighborhood(frm) {
    // get Neighborhood of selected city
    frm.fields_dict["custom_neighborhood"].get_query = function (doc) {
        return {
            filters: [["Neighborhood", "city", "=", frm.doc.custom_city1]],
        };
    };
}