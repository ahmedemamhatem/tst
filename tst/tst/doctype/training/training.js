// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Training', {
    refresh(frm) {
        // Add custom button if doc is submitted and there are sessions
        if (frm.doc.docstatus === 1 && frm.doc.training_schedule?.length) {
            frm.add_custom_button('Create Session', () => {
                handle_session_creation_popup(frm);
            });
        }
    }
});

function handle_session_creation_popup(frm) {
    if (frm.doc.docstatus === 1 && frm.doc.training_schedule?.length) {
        // Find next upcoming session that is not completed
        const upcoming_sessions = frm.doc.training_schedule
            .filter(s => (s.status !== "Completed" && s.status !== "Created" && s.status !== "Rescheduled"))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const next_session = upcoming_sessions[0];

        if (next_session) {
            show_session_popup(frm, next_session.date,next_session.name);
        }
        else{
            show_session_popup(frm, frappe.datetime.get_today());
        }
    }
}

function show_session_popup(frm, default_date, row_name) {
    const scheduled_dates = frm.doc.training_schedule.map(s => s.date);

    let d = new frappe.ui.Dialog({
        title: 'Create New Training Session',
        fields: [
            {
                label: 'Session Date',
                fieldname: 'session_date',
                fieldtype: 'Date',
                default: default_date,
                reqd: 1,
                onchange: function () {
                    const selected_date = d.get_value('session_date');
                    const date_in_schedule = scheduled_dates.includes(selected_date);
                    d.set_value('date_not_in_schedule', !date_in_schedule);

                    const today = frappe.datetime.get_today();

                    // If selected date is before today, reset field and show error
                    if (selected_date < today && selected_date) {
                        frappe.msgprint('You cannot select a date before today.');
                        d.set_value('session_date', null);
                        return;
                    }

                    // Optionally reset reason/compensated fields if date is in schedule
                    if (date_in_schedule) {
                        d.set_value('reason', null);
                        d.set_value('compensated_session', null);
                    }
                }
            },
            {
                label: 'Session Time',
                fieldname: 'session_time',
                fieldtype: 'Time',
                reqd: 1
            },
            {
                label: 'Subject',
                fieldname: 'subject',
                fieldtype: 'Small Text',
                reqd: 1
            },
            {
                label: 'Session Type',
                fieldname: 'session_type',
                fieldtype: 'Select',
                options: ["Online", "Offline"],
                reqd: 1
            },
            {
                label: 'Trainer',
                fieldname: 'trainer',
                fieldtype: 'Link',
                options: 'Employee',
                reqd: 1
            },
            {
                label: 'Reason',
                fieldname: 'reason',
                fieldtype: 'Select',
                options: ['Additional', 'Compensation'],
                depends_on: 'eval:doc.date_not_in_schedule',
                description: 'Why are you creating a session on a new date?'
            },
            {
                label: 'Compensated Session',
                fieldname: 'compensated_session',
                fieldtype: 'Select',
                options: frm.doc.training_schedule
                    .filter(s => (s.status !== "Completed" && s.status !== "Rescheduled"))
                    .map(s => ({ label: s.date, value: s.date })),
                depends_on: 'eval:doc.reason=="Compensation"',
                description: 'Which session is this one compensating for?'
            },
            {
                fieldname: 'date_not_in_schedule',
                fieldtype: 'Check',
                hidden: 1
            }
        ],
        primary_action_label: 'Create Session',
        primary_action(values) {
            const date_changed = values.session_date !== default_date;
            const date_in_schedule = scheduled_dates.includes(values.session_date);

            // Show validation if date changed and it's not in the schedule
            if (date_changed && !date_in_schedule && !values.reason) {
                frappe.msgprint("Please specify the reason for using a new date.");
                return;
            }

            // If compensation selected but not linked to any session
            if (values.reason === 'Compensation' && !values.compensated_session) {
                frappe.msgprint("Please select the session this is compensating for.");
                return;
            }

            frappe.call({
                method: "tst.tst.doctype.training.training.create_new_session",
                args: {
                    training_name: frm.doc.name,
                    session_date: values.session_date,
                    session_time: values.session_time,
                    trainer: values.trainer,
                    subject: values.subject,
                    session_type: values.session_type,
                    session_row_name: row_name,
                    reason: values.reason || "",
                    compensated_session: values.compensated_session || ""
                },
                callback: function (r) {
                    frappe.msgprint("Session created successfully.");
                    d.hide();
                    frm.reload_doc();
                }
            });
        }
    });

    // When dialog loads, check if the default date is in schedule
    const is_new_date = !scheduled_dates.includes(default_date);
    d.set_value('date_not_in_schedule', is_new_date);

    d.show();
}
