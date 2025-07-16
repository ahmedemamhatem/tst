import frappe
from frappe import _


def validate(self, method):
    pass


def after_insert(self, method):
    # Customer ID Counter
    counter = frappe.get_doc("Customer Counter")
    counter.increment()
    self.custom_customer_id = counter.customer_id
    self.save()


def on_update(self, method):
    pass
