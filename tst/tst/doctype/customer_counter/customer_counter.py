# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CustomerCounter(Document):
    def increment(self):
        """Increment the counter by 1."""
        self.customer_id = (0 if self.customer_id is None else self.customer_id) + 1
        self.save()
