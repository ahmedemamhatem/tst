
import frappe


@frappe.whitelist()
def after_insert(doc, method=None):
    pass
        
        

@frappe.whitelist()
def validate(doc, method=None):
    for row in doc.items:
        row.custom_installation_order = frappe.db.get_value("Material Request", row.material_request , "custom_installation_order")

@frappe.whitelist()
def on_submit(doc, method=None):
    pass
