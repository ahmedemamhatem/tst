# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class InstallationOrder(Document):
	# def validate(self):
	# 	if self.technicians:
	# 		if len(self.technicians) > 1:
	# 			frappe.throw(_("Only one technician can be assigned to an installation order. Assign Sub Technicians instead."))
	def on_submit(self):
		# create Appointments
		# for technician in self.technicians:
		appointment = frappe.new_doc("Appointment")
		appointment.scheduled_time = frappe.utils.now_datetime()
		appointment.status = "Open"
		appointment.custom_technician = self.technician
		appointment.custom_installation_order = self.name
		appointment.custom_technician_warehouse = self.warehouse
		appointment.customer_name = frappe.db.get_value("Technician", self.technician, "technician_name")
		appointment.appointment_with = "Customer"
		appointment.party = self.customer
		appointment.custom_customer_address = self.customer_address
		appointment.customer_email = self.customer_email
		appointment.save()

		for technician in self.sub_installation_order_technician:
			appointment = frappe.new_doc("Appointment")
			appointment.custom_is_sub_technician = 1
			appointment.scheduled_time = frappe.utils.now_datetime()
			appointment.status = "Open"
			appointment.custom_technician = technician.technician
			appointment.custom_installation_order = self.name
			appointment.custom_technician_warehouse = technician.warehouse
			appointment.customer_name = frappe.db.get_value("Technician", technician.technician, "technician_name")
			appointment.appointment_with = "Customer"
			appointment.party = self.customer
			appointment.custom_customer_address = self.customer_address
			appointment.customer_email = self.customer_email
			appointment.save()