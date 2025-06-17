# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class TrainingSession(Document):
	@frappe.whitelist()
	def validate(self):
		self.update_training_status()


	def update_training_status(self):
		if self.status != "Open":
			if self.status == "Completed" and not self.ends_on:
				frappe.throw(_("Please specify the 'Ends On' date before marking the training as Completed."))

			frappe.db.sql("""
						update 
							`tabTraining Schedule`
						set 
							status = %s,
							starts_on = %s,
							ends_on = %s 
						where 
							name = %s
						""",(self.status,self.starts_on,self.ends_on,self.reference_name))
			frappe.db.commit()
		
