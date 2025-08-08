# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import get_link_to_form
from frappe import _


class VehicleAppointment(Document):
    def on_submit(self):
        if not self.choose_serial_and_batch_bundle:
            frappe.throw(_("Please add at least one Serial No or Batch Bundle."))
        create_device_setup(self)

    def validate(self):
        validate_item_serial_qty_to_so_qty(self)


def validate_item_serial_qty_to_so_qty(self):
    if not self.sales_order:
        frappe.throw(_("Sales Order is required to validate serial numbers."))
    total_qty = frappe.db.get_value(
        "Sales Order",
        self.sales_order,
        "total_qty",
    )
    if len(self.choose_serial_and_batch_bundle) > total_qty:
        frappe.throw(
            _(
                "The number of Serial No  entries exceeds the total quantity in Sales Order."
            )
        )


def create_device_setup(self):
    for row in self.choose_serial_and_batch_bundle:
        device_setup = frappe.new_doc("Device Setup")
        device_setup.status = "Installing"
        device_setup.appointment = self.appointment
        if device_setup_name := frappe.db.get_value(
            "Device Setup",
            {
                "serial_no": row.serial_no,
            },
        ):
            frappe.msgprint(
                _(
                    f"There is a Device Setup Still Open {get_link_to_form('Device Setup', device_setup_name)} Serial NO: {row.serial_no}"
                )
            )
            continue
        device_setup.vehicle_data = self.vehicle
        device_setup.vehicle_name = self.vehicle_name
        device_setup.vehicle_type = self.vehicle_type
        device_setup.serial_no = row.serial_no
        device_setup.vehicle_appointment = self.name
        device_setup.save()
    self.status = "Closed"
    frappe.msgprint(_("Sent to Server Setup Team"))


def copy_attachment_to_serial_no(attachment_url, serial_no_doc):
    """Copy attachment from current doc to Serial No document"""
    from frappe.utils.file_manager import save_file

    # Get the file data from the attachment
    file_name = attachment_url.split("/")[-1]
    file_data = frappe.get_doc("File", {"file_url": attachment_url})

    # Save the file to the Serial No document
    save_file(
        fname=file_name,
        content=file_data.get_content(),
        dt="Serial No",
        dn=serial_no_doc.name,
        folder="Home/Attachments",
        is_private=0,
    )

    # Commit to ensure the file is saved before proceeding
    frappe.db.commit()
