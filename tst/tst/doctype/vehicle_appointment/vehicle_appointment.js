// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

frappe.ui.form.on("Vehicle Appointment", {
	refresh(frm) {
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
        frm.add_custom_button(__('Return to Appointment'), function () {
            if (frm.doc.appointment) {
                frappe.set_route('Form', 'Appointment', frm.doc.appointment);
            } else {
                frappe.msgprint(__('No appointment linked to this vehicle appointment.'));
            }
        }).addClass('btn-primary');
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
                device_row.serial_no = frm.doc.serial_number;
                frm.refresh_field("choose_serial_and_batch_bundle");
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
