

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
    if (frm.custom_next_status_button ) {
        cur_frm.remove_custom_button(__(frm.custom_next_status_button));

    }
    if (frm.doc.status != 'Closed') {
        // add button to cancel appointment
        frm.add_custom_button(__('Cancel Appointment'), function () {
            frappe.confirm(
                __('Are you sure you want to cancel this appointment?'),
                function () {
                    // If confirmed, update the status and perform any additional actions
                    updateStatus(frm, 'Cancelled', 'Closed');
                }
            );
        });
    }else {
        // reopent appointment button
        frm.add_custom_button(__('Reopen Appointment'), function () {
            frappe.confirm(
                __('Are you sure you want to reopen this appointment?'),
                function () {
                    // If confirmed, update the status and perform any additional actions
                    updateStatus(frm, 'Pending', 'Open');
                }
            );
        });
    }
    // Add new button
    if(frm.doc.custom_appointment_status != 'Done Installation' && frm.doc.status != 'Closed' ) {
    frm.add_custom_button(__('Next: {0}', [nextStatus]), function () {
            promptForStatusUpdate(frm);
        }).addClass(statusColors[nextStatus] || 'btn-default');
    }

    if (frm.doc.custom_appointment_status == 'Start Installation') {
        frm.add_custom_button(
        __('Start Installing Device'),() => {
        
            frappe.model.open_mapped_doc({
                method: 'tst.triggers.crm.appointment.appointment.make_vehicle_appointment',
                frm: frm,
            })
        }
    ).addClass('btn-primary');
}

    // Store reference to the button for later removal
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
            updateStatus(frm, nextStatus);
        },
        function () {
            frappe.show_alert(__('Status update cancelled'), 3);
        }
    );
}

// Modify the updateStatus function to update the button after status change
function updateStatus(frm, nextStatus, status = 'Open') {
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

                    frm.doc.status = status;
                    frm.refresh_field("status");
                    frm.save();
                    
                });
            }
        },
        freeze: true,
        freeze_message: __('Updating Status...')
    });
}



