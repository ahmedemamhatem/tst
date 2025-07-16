# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_link_to_form


class DeviceSetup(Document):
    def validate(self):
        if device_setup := frappe.db.get_value(
            "Device Setup",
            {
                "name": ["!=", self.name],
                "serial_no": self.serial_no,
                "status": ["not in", ["Inactive", "Broken", "Archived", "Suspended"]],
                "docstatus": ["!=", 2],
            },
        ):
            frappe.throw(
                _(
                    f"There is a Device Setup Still Open {get_link_to_form('Device Setup', device_setup)} Serial NO: {self.serial_no}"
                )
            )
        if not self.posting_date:
            self.posting_date = frappe.utils.now()

    def after_insert(self):
        self.update_serial_no()

    def on_submit(self):
        pass

    def on_cancel(self):
        self.clear_serial_no_references()

    def update_serial_no(self):
        if not frappe.db.get_value("Serial No", self.serial_no):
            return

        serial_no_doc = frappe.get_doc("Serial No", self.serial_no)
        serial_no_doc.custom_device_setup = self.name
        serial_no_doc.append(
            "custom_device_setup_log",
            {
                "device_setup": self.name,
                "setup_date": self.posting_date,
                "status": "Active",  # Add status field if needed
            },
        )
        serial_no_doc.save()

    def clear_serial_no_references(self):
        if not self.serial_no:
            return

        if frappe.db.get_value("Serial No", self.serial_no):
            serial_no_doc = frappe.get_doc("Serial No", self.serial_no)

            # Clear the device setup reference
            if serial_no_doc.custom_device_setup == self.name:
                serial_no_doc.custom_device_setup = None

            # Remove all log entries related to this setup
            serial_no_doc.custom_device_setup_log = [
                log
                for log in serial_no_doc.custom_device_setup_log
                if log.device_setup != self.name
            ]

            serial_no_doc.save()
