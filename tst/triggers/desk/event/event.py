import frappe
from frappe import _
@frappe.whitelist()
def validate(doc,method =None):
    update_training_status(doc)
    
    
def update_training_status(doc):
    if doc.status != "Open":
        if doc.status == "Completed" and not doc.ends_on:
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
                      """,(doc.status,doc.starts_on,doc.ends_on,doc.custom_reference_name))
        frappe.db.commit()
    