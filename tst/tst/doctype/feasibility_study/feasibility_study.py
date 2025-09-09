# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
import frappe

class FeasibilityStudy(Document):
    def validate(self):
        # Check if a submitted Feasibility Study already exists for the same Development Request
        if self.docstatus == 1:  # Ensure this validation is only for submitted documents
            if frappe.db.exists('Feasibility Study', {
                'development_request': self.development_request,
                'docstatus': 1,  # Only check submitted documents
                'name': ['!=', self.name]  # Exclude the current document
            }):
                frappe.throw(f"A submitted Feasibility Study already exists for Development Request {self.development_request}.")