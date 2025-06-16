frappe.ui.form.on("Appointment", {
    refresh: function (frm) {
        frm.get_field('custom_choose_serial_and_batch_bundle').grid.wrapper.find(".grid-add-row").hide();
        frm.set_query("custom_serial_no", function () {
            return {
                query: "tst.api.serial_no_query",
                filters: {
                    "custom_installation_order": frm.doc.custom_installation_order,
                }
            };
        });

    },
    custom_appointment_status: function (frm) {
        // Fetch current location before saving
        frm.events.getCurrentLocation(frm).then(() => {
            // This code runs only after location is fetched (or fails)
            if (frm.doc.custom_current_longitude && frm.doc.custom_current_latitude) {
                if (frm.doc.custom_technician_location) {
                    if (frm.doc.custom_technician_location.indexOf(frm.doc.custom_technician_location.length - 1).status != frm.doc.custom_appointment_status) {
                        let child_row = frm.add_child("custom_technician_location");
                        child_row.long = frm.doc.custom_current_longitude;
                        child_row.lat = frm.doc.custom_current_latitude;
                        child_row.time = frappe.datetime.now_datetime();
                        child_row.status = frm.doc.custom_appointment_status;
                        frm.refresh_field("custom_technician_location");
                        frm.save()
                    }
                } else {
                    let child_row = frm.add_child("custom_technician_location");
                    child_row.long = frm.doc.custom_current_longitude;
                    child_row.lat = frm.doc.custom_current_latitude;
                    child_row.time = frappe.datetime.now_datetime();
                    child_row.status = frm.doc.custom_appointment_status;
                    frm.refresh_field("custom_technician_location");
                    frm.save()

                }
            } else {
                frappe.msgprint("Could not fetch location data. Please ensure location permissions are granted.");
            }
        });
    },
    getCurrentLocation: function (frm) {
        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        // Success: Update the form with coordinates
                        frm.set_value("custom_current_longitude", position.coords.longitude);
                        frm.set_value("custom_current_latitude", position.coords.latitude);
                        resolve();
                    },
                    (error) => {
                        // Error: Log and resolve anyway (you might want to handle this differently)
                        console.error("Geolocation error:", error);
                        frappe.msgprint("Location access denied or failed. Using default coordinates.");
                        resolve();
                    }
                );
            } else {
                frappe.msgprint("Geolocation is not supported by this browser.");
                resolve();
            }
        });
    },
    custom_append_device: function (frm) {
        if (!frm.doc.custom_serial_no) {
            frappe.msgprint("Please select a Serial and Batch Bundle and Serial No before appending.");
            return;
        }
        let device_row = frm.add_child("custom_choose_serial_and_batch_bundle");
        device_row.serial_no = frm.doc.custom_serial_no;
        frm.refresh_field("custom_choose_serial_and_batch_bundle");
        frm.doc.custom_serial_no = "";
        frm.doc.custom_item_code = "";
        frm.doc.custom_item_name = "";

        frm.refresh_field("custom_serial_no");
        frm.refresh_field("custom_item_code");
        frm.refresh_field("custom_item_name");
    },
});

frappe.ui.form.on("Technician Location", "show_location", function (frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (row.long && row.lat) {
        // Open a new window with the Google Maps URL
        window.open(`https://www.google.com/maps/@${row.lat},${row.long},15z`, '_blank');
    } else {
        frappe.msgprint("Location coordinates are not available.");
    }
});