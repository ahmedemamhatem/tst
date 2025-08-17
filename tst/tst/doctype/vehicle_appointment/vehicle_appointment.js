// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Vehicle Appointment", {
	refresh(frm) {
        setTimeout(() => {
            render_custom_ui(frm);
        }, 300);
        frm.fields_dict.choose_serial_and_batch_bundle.grid.wrapper.find(".grid-add-row").remove();
        frm.set_query("serial_number", function () {
                    return {
                        query: "tst.api.serial_no_query",
                        filters: {
                            "installation_order": frm.doc.installation_order,
                            "warehouse": frm.doc.warehouse,
                        }
                    };
                });
        // add button to return to appointment
       if (frm.doc.docstatus==1)
        { frm.add_custom_button(__('Return to Appointment'), function () {
            if (frm.doc.appointment) {
                frappe.set_route('Form', 'Appointment', frm.doc.appointment);
            } else {
                frappe.msgprint(__('No appointment linked to this vehicle appointment.'));
            }
        }).addClass('btn-primary');}
    },
    
    append_device: function (frm) {
        if (!frm.doc.serial_number) {
            frappe.msgprint("Please select a Serial and Batch Bundle and Serial No before appending.");
            return;
        }
        let found = false
        if (frm.doc.serial_number) {
            frm.doc.choose_serial_and_batch_bundle.forEach(element => {
                if (element.serial_no == frm.doc.serial_number) {
                    frappe.msgprint(__("Serial No Already Exists in Table"))
                    found = true

                }
            });
            if (!found) {
                let device_row = frm.add_child("choose_serial_and_batch_bundle");

// set serial number
device_row.serial_no = frm.doc.serial_number;

// first get item_code from Serial No doctype
if (frm.doc.serial_number) {
    frappe.db.get_value("Serial No", frm.doc.serial_number, "item_code")
        .then(r1 => {
            if (r1 && r1.message && r1.message.item_code) {
                let item_code = r1.message.item_code;

                // now get has_sim from Item
                frappe.db.get_value("Item", item_code, "has_sim")
                    .then(r2 => {
                        if (r2 && r2.message) {
                            device_row.has_sim = r2.message.has_sim ? 1 : 0; // assuming field exists in child table
                            device_row.item_code = item_code; // optional, if you want to store it in row
                            frm.refresh_field("choose_serial_and_batch_bundle");
                        }
                    });
            }
        });
}

// clear main form fields
frm.doc.serial_number = "";
frm.doc.item_code = "";
frm.doc.item_name = "";

frm.refresh_field("serial_number");
frm.refresh_field("item_code");
frm.refresh_field("item_name");

            }
        }
    },
});

function render_custom_ui(frm) {
    const wrapper = frm.fields_dict.vehicle_no.$wrapper.find('.custom-ui');

    // Ensure wrapper exists
    if (!wrapper.length) return;

    wrapper.empty();

    let html = `
        <style>
            .plate {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: #fff;
                border: 1px solid #e6e7eb;
                border-radius: 12px;
            }
            .plate .group {
                display: flex;
                gap: 8px;
            }
            .plate .separator {
                width: 14px;
                height: 3px;
                background: #d0d3db;
                border-radius: 2px;
                margin: 0 2px;
            }
            .plate .cell {
                width: 50px;
                height: 50px;
            }
            .plate .cell input {
                width: 100%;
                height: 100%;
                text-align: center;
                text-transform: uppercase;
                font-size: 20px;
                font-weight: bold;
                border: 2px solid #cfd3dd;
                border-radius: 8px;
                outline: none;
            }
            .plate .cell input:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
            }
        </style>
        
        <div class="plate">
            <!-- Letters (3) -->
            <div class="group letters">
                <div class="cell"><input type="text" maxlength="1" pattern="[A-Za-z]" placeholder="A"></div>
                <div class="cell"><input type="text" maxlength="1" pattern="[A-Za-z]" placeholder="B"></div>
                <div class="cell"><input type="text" maxlength="1" pattern="[A-Za-z]" placeholder="C"></div>
            </div>
            
            <div class="separator"></div>
            
            <!-- Numbers (4) -->
            <div class="group numbers">
                <div class="cell"><input type="text" maxlength="1" pattern="[0-9]" placeholder="1"></div>
                <div class="cell"><input type="text" maxlength="1" pattern="[0-9]" placeholder="2"></div>
                <div class="cell"><input type="text" maxlength="1" pattern="[0-9]" placeholder="3"></div>
                <div class="cell"><input type="text" maxlength="1" pattern="[0-9]" placeholder="4"></div>
            </div>
        </div>
    `;

    wrapper.html(html);

    // Attach event listeners
    wrapper.find("input").on("input", function() {
        let letters = wrapper.find(".letters input").map(function(){ return $(this).val().toUpperCase(); }).get().join("");
        let numbers = wrapper.find(".numbers input").map(function(){ return $(this).val(); }).get().join("");
        let full_plate = letters + numbers;

        // Store in hidden data field
        frm.set_value("vehicle1", full_plate);
    });

    // Pre-fill if vehicle_no already has value
    if (frm.doc.vehicle_no) {
        let val = frm.doc.vehicle_no;
        let letters = val.slice(0,3).split("");
        let numbers = val.slice(3).split("");

        wrapper.find(".letters input").each(function(i){
            $(this).val(letters[i] || "");
        });
        wrapper.find(".numbers input").each(function(i){
            $(this).val(numbers[i] || "");
        });
    }
}
