

frappe.ui.form.on("Technician Location", "show_location", function (frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (row.long && row.lat) {
        window.open(`https://www.google.com/maps/@${row.lat},${row.long},15z`, '_blank');
    } else {
        frappe.msgprint("Location coordinates are not available.");
    }
});



frappe.ui.form.on("Appointment", {
    refresh: function (frm) {
        // Add custom button
        addCustomStatusButton(frm);
    },
    after_save: function (frm) {

         if (frm.doc.attachment) {
            frm.set_value("attachment", "");
        }
        frm.doc.calendar_event = '';
    },
    custom_append_device: function(frm) {
        let raw_input = frm.doc.custom_barcode;

        if (raw_input) {
            let scanned_value = "";

            // Case 1: It's plain text already
            if (/^\d+$/.test(raw_input.trim())) {
                scanned_value = raw_input.trim();
            } else {
                // Case 2: Extract from SVG
                let div = document.createElement("div");
                div.innerHTML = raw_input;

                // Try data-barcode-value first
                let svg = div.querySelector("svg");
                if (svg && svg.getAttribute("data-barcode-value")) {
                    scanned_value = svg.getAttribute("data-barcode-value");
                } else {
                    // Fallback: get text inside <text> tag
                    let textNode = div.querySelector("text");
                    if (textNode) {
                        scanned_value = textNode.textContent.trim();
                    }
                }
            }

            if (scanned_value) {
                let child = frm.add_child("custom_choose_serial_and_batch_bundle");
                child.serial_no = scanned_value;

                frm.refresh_field("custom_choose_serial_and_batch_bundle");
            }

            frm.set_value("custom_barcode", "");
        }
    },
    
    getCurrentLocation: function (frm) {

        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        frm.set_value("custom_current_longitude", position.coords.longitude);
                        frm.set_value("custom_current_latitude", position.coords.latitude);
                        resolve();
                    },
                    (error) => {
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
});

// Function to add custom button
function addCustomStatusButton(frm) {
    const statusFlow = [
        'Pending',
        'Delivering to Customer',
        'Arrived at Customer',
        'Start Installation',
        'Done Installation'
    ];

    const currentStatus = frm.doc.custom_appointment_status || 'Pending';
    const currentIndex = statusFlow.indexOf(currentStatus);
    let nextStatus = currentIndex === -1 || currentIndex === statusFlow.length - 1
        ? statusFlow[0]
        : statusFlow[currentIndex + 1];

    // Button color mapping
    const statusColors = {
        'Pending': 'btn-warning',
        'Delivering to Customer': 'btn-info',
        'Arrived at Customer': 'btn-primary',
        'Start Installation': 'btn-success',
        'Done Installation': 'btn-success'
    };

    // Remove existing button if it exists
    if (frm.custom_next_status_button) {
        cur_frm.remove_custom_button(__(frm.custom_next_status_button));
    }

    // Cancel / Reopen buttons
    if (frm.doc.status != 'Closed') {
        frm.add_custom_button(__('Cancel Appointment'), function () {
            frappe.confirm(
                __('Are you sure you want to cancel this appointment?'),
                function () {
                    updateStatus(frm, 'Cancelled', 'Closed');
                }
            );
        });
    } else {
        frm.add_custom_button(__('Reopen Appointment'), function () {
            frappe.confirm(
                __('Are you sure you want to reopen this appointment?'),
                function () {
                    updateStatus(frm, 'Pending', 'Open');
                }
            );
        });
    }

    // Add Next Status button if not closed or done
if (frm.doc.custom_appointment_status != 'Done Installation' && frm.doc.status != 'Closed') {
    // Prevent Done Installation from showing unless condition is met
    if (nextStatus !== 'Done Installation') {
        frm.add_custom_button(__('Next: {0}', [nextStatus]), function () {
            promptForStatusUpdate(frm);
        }).addClass(statusColors[nextStatus] || 'btn-default');
    }
}

    // Show "Start Installing Device"
    if (frm.doc.custom_appointment_status == 'Start Installation') {
        frm.add_custom_button(__('Start Installing Device'), () => {
            frappe.model.open_mapped_doc({
                method: 'tst.triggers.crm.appointment.appointment.make_vehicle_appointment',
                frm: frm,
            });
        }).addClass('btn-primary');
    }

    //Conditionally show "Done Installation"
if (frm.doc.custom_appointment_status == 'Start Installation') {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Device Setup",
            filters: { appointment: frm.doc.name },
            fields: ["name", "docstatus"]
        },
        callback: function (r) {
            // Debug: show the full response
            // frappe.msgprint(__('Device Setup response: {0}', [JSON.stringify(r.message)]));

           if (r.message && r.message.length > 0) {
    let all_submitted = r.message.every(d => d.docstatus === 1);
    // frappe.msgprint(__('All submitted? {0}', [all_submitted]));
    
    if (all_submitted) {
        frm.add_custom_button(__('Done Installation'), function () {
            updateStatus(frm, 'Done Installation');
        }).addClass('btn-success');
    }
}

        }
    });
}


    // Store reference to the button
    frm.custom_next_status_button = frm.page.btn_primary;
}

// Modify your existing promptForStatusUpdate function
function promptForStatusUpdate(frm) {
    const statusFlow = [
        'Pending',
        'Delivering to Customer',
        'Arrived at Customer',
        'Start Installation',
        'Done Installation'
    ];

    const currentStatus = frm.doc.custom_appointment_status || 'Pending';
    const currentIndex = statusFlow.indexOf(currentStatus);
    let nextStatus = currentIndex === -1 || currentIndex === statusFlow.length - 1
        ? statusFlow[0]
        : statusFlow[currentIndex + 1];

    frappe.confirm(
        __('Are you sure you want to change status from {0} to {1}?', [currentStatus, nextStatus]),
        function () {
            // console.log(nextStatus)
            updateStatus(frm, nextStatus);
        },
        function () {
            frappe.show_alert(__('Status update cancelled'), 3);
        }
    );
}

// Modify the updateStatus function to update the button after status change
function updateStatus(frm, nextStatus, status = 'Open') {
    frm.set_value('custom_appointment_status', nextStatus).then(() => {
        frm.events.getCurrentLocation(frm).then(() => {
            // Add to technician location table
            let child_row = frm.add_child("custom_technician_location");
            child_row.long = frm.doc.custom_current_longitude;
            child_row.lat = frm.doc.custom_current_latitude;
            child_row.time = frappe.datetime.now_datetime();
            child_row.status = nextStatus;

            frm.refresh_field("custom_technician_location");

            frm.set_value('status', status);

            // frm.save();
            frm.refresh()
        });
    });
}



