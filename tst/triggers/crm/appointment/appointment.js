

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
        frm.set_query("custom_serial_no", function () {
            return {
                query: "tst.api.serial_no_query",
                filters: {
                    "custom_installation_order": frm.doc.custom_installation_order,
                    "warehouse": frm.doc.custom_technician_warehouse,
                }
            };
        });
        frm.fields_dict.custom_choose_serial_and_batch_bundle.grid.wrapper.find(".grid-add-row").remove();

        // Remove the existing button field if it's visible
        if (frm.fields_dict.custom_next_status) {
            frm.fields_dict.custom_next_status.$wrapper.hide();
        }

        // Add custom button
        // if (frm.doc.custom_appointment_status != "Done Installation") {
        addCustomStatusButton(frm);
        // }
    },
    custom_append_device: function (frm) {
        if (!frm.doc.custom_serial_no) {
            frappe.msgprint("Please select a Serial and Batch Bundle and Serial No before appending.");
            return;
        }
        let found = false
        if (frm.doc.custom_serial_no) {
            frm.doc.custom_choose_serial_and_batch_bundle.forEach(element => {
                if (element.serial_no == frm.doc.custom_serial_no) {
                    frappe.msgprint(__("Serial No Already Exists in Table"))
                    found = true

                }
            });
            if (!found) {
                let device_row = frm.add_child("custom_choose_serial_and_batch_bundle");
                device_row.serial_no = frm.doc.custom_serial_no;
                frm.refresh_field("custom_choose_serial_and_batch_bundle");
                frm.doc.custom_serial_no = "";
                frm.doc.custom_item_code = "";
                frm.doc.custom_item_name = "";

                frm.refresh_field("custom_serial_no");
                frm.refresh_field("custom_item_code");
                frm.refresh_field("custom_item_name");
                frm.dirty()
            }
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
        'Stock Available',
        'Delivering to Customer',
        'Arrived at Customer',
        'Start Installation',
        'Done Installation'
    ];

    const currentStatus = frm.doc.custom_appointment_status || 'Out of Stock';
    const currentIndex = statusFlow.indexOf(currentStatus);
    let nextStatus = currentIndex === -1 || currentIndex === statusFlow.length - 1
        ? statusFlow[0]
        : statusFlow[currentIndex + 1];

    // Button color mapping
    const statusColors = {
        'Stock Available': 'btn-warning',
        'Delivering to Customer': 'btn-info',
        'Arrived at Customer': 'btn-primary',
        'Start Installation': 'btn-success',
        'Done Installation': 'btn-success'
    };

    // Remove existing button if it exists
    if (frm.custom_next_status_button) {
        frm.custom_next_status_button.remove();
    }

    // Add new button
    frm.add_custom_button(__('Next: {0}', [nextStatus]), function () {
        promptForStatusUpdate(frm);
    }).addClass(statusColors[nextStatus] || 'btn-default');

    // Store reference to the button for later removal
    frm.custom_next_status_button = frm.page.btn_primary;
}

// Modify your existing promptForStatusUpdate function
function promptForStatusUpdate(frm) {
    const statusFlow = [
        'Stock Available',
        'Delivering to Customer',
        'Arrived at Customer',
        'Start Installation',
        'Done Installation'
    ];

    const currentStatus = frm.doc.custom_appointment_status || 'Out of Stock';
    const currentIndex = statusFlow.indexOf(currentStatus);
    let nextStatus = currentIndex === -1 || currentIndex === statusFlow.length - 1
        ? statusFlow[0]
        : statusFlow[currentIndex + 1];

    frappe.confirm(
        __('Are you sure you want to change status from {0} to {1}?', [currentStatus, nextStatus]),
        function () {
            updateStatus(frm, nextStatus);
        },
        function () {
            frappe.show_alert(__('Status update cancelled'), 3);
        }
    );
}

// Modify the updateStatus function to update the button after status change
function updateStatus(frm, nextStatus) {
    frappe.call({
        method: 'frappe.client.set_value',
        freeze: 1,
        args: {
            doctype: frm.doctype,
            name: frm.docname,
            fieldname: 'custom_appointment_status',
            value: nextStatus
        },
        callback: function (r) {
            if (!r.exc) {
                frm.events.getCurrentLocation(frm).then(() => {
                    // Add to technician location table
                    let child_row = frm.add_child("custom_technician_location");
                    child_row.long = frm.doc.custom_current_longitude;
                    child_row.lat = frm.doc.custom_current_latitude;
                    child_row.time = frappe.datetime.now_datetime();
                    child_row.status = nextStatus;

                    frm.refresh_field("custom_technician_location");

                    // Update the custom button
                    addCustomStatusButton(frm);
                    frm.save()
                    frm.reload()
                });
            }
        },
        freeze: true,
        freeze_message: __('Updating Status...')
    });
}



