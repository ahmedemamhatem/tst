# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta


class Training(Document):
    def validate(self):
        if self.docstatus == 0:  # Only for draft documents
            self.fill_training_schedule()

    def on_submit(self):
        self.update_serial_no()

    def on_cancel(self):
        self.clear_serial_no_references()

    def update_serial_no(self):
        """Link this training to the serial no and add to log"""
        if not frappe.db.get_value("Serial No", self.serial_no):
            return

        serial_no_doc = frappe.get_doc("Serial No", self.serial_no)
        serial_no_doc.custom_training_session = self.name
        serial_no_doc.append(
            "custom_training_sessions",
            {
                "training": self.name,
            },
        )
        serial_no_doc.save()

    def clear_serial_no_references(self):
        """Remove references from serial no when training is cancelled"""
        if not self.serial_no:
            return

        if frappe.db.get_value("Serial No", self.serial_no):
            serial_no_doc = frappe.get_doc("Serial No", self.serial_no)

            # Clear the main training reference if it points to this doc
            if serial_no_doc.custom_training_session == self.name:
                serial_no_doc.custom_training_session = None

            # Remove all training log entries for this training
            serial_no_doc.custom_training_sessions = [
                session
                for session in serial_no_doc.custom_training_sessions
                if session.training != self.name
            ]

            serial_no_doc.save()
            frappe.msgprint(
                _("Cleared training references from Serial No {0}").format(
                    self.serial_no
                )
            )

    def fill_training_schedule(self):
        """
        Auto-fill the training_schedule child table based on:
        - start_date: The date of the first session.
        - number_of_sessions: Total number of sessions to generate.
        - periodicity: Frequency of sessions (Daily, Weekly, Monthly).

        This method clears the current training_schedule and fills it
        with session dates based on the provided configuration.
        """
        # Ensure required fields are provided
        if not self.start_date or not self.number_of_sessions or not self.periodicity:
            return

        # Convert start_date (which is a string) to a date object
        if isinstance(self.start_date, str):
            current_date = datetime.strptime(self.start_date, "%Y-%m-%d").date()
        else:
            current_date = self.start_date  # already a date object

        # Clear existing schedule
        self.training_schedule = []

        # Generate session dates
        for i in range(self.number_of_sessions):
            # Append a new row to the child table
            self.append(
                "training_schedule", {"date": current_date, "status": "Pending"}
            )

            # Advance the date based on periodicity
            if self.periodicity == "Daily":
                current_date += timedelta(days=1)
            elif self.periodicity == "Weekly":
                current_date += timedelta(weeks=1)
            elif self.periodicity == "Monthly":
                current_date += relativedelta(months=1)


@frappe.whitelist()
def create_new_session(
    training_name,
    session_date,
    session_time,
    trainer,
    subject,
    session_type,
    compensated_session=None,
    reason=None,
    session_row_name=None,
):
    """
    This method creates training session.

    If the selected date is already in the Training Schedule table, it updates that row and links it to the new Sessiom.

    If the selected date does NOT exist, it adds a new row with the given date, time, trainer, and other details, then creates the Session and links it to that new row.
    """

    starts_on = datetime.strptime(f"{session_date} {session_time}", "%Y-%m-%d %H:%M:%S")

    training_doc = frappe.get_doc("Training", training_name)

    # Try to find an existing row with the same date
    existing_row = None
    for row in training_doc.training_schedule:
        if str(row.date) == str(session_date):
            existing_row = row
            break

    # If not found, append a new row
    if not existing_row:
        new_row = training_doc.append(
            "training_schedule",
            {
                "date": session_date,
                "reason": reason,
                "compensated_session": compensated_session,
                "unscheduled_session": 1,
            },
        )
        training_doc.save()

        if compensated_session:
            old_session_name = frappe.get_cached_value(
                "Training Schedule",
                {"date": compensated_session, "parent": training_name},
                "name",
            )

            frappe.db.sql(
                """
                UPDATE `tabTraining Schedule`
                SET status = %s
                WHERE name = %s
            """,
                ("Rescheduled", old_session_name),
            )
        session_row_name = new_row.name
    else:
        # Update the existing row directly in the DB later
        session_row_name = existing_row.name

    # get trainer name
    trainer_name = frappe.get_cached_value(
        "Employee", {"name": trainer}, "employee_name"
    )

    # Create session
    session = frappe.new_doc("Training Session")
    session.subject = subject
    session.starts_on = starts_on
    session.session_type = session_type
    session.trainer = trainer
    session.trainer_name = trainer_name
    session.reference_doctype = "Training"
    session.reference_link = training_name
    session.reference_name = session_row_name
    session.insert(ignore_permissions=True)

    if session.name:
        frappe.db.sql(
            """
            UPDATE `tabTraining Schedule`
            SET status = %s, trainer = %s,trainer_name =%s, session_type = %s, session = %s
            WHERE name = %s
        """,
            (
                "Created",
                trainer,
                trainer_name,
                session_type,
                session.name,
                session_row_name,
            ),
        )
        frappe.db.commit()

    frappe.msgprint(f"session created on {session_date}.")
