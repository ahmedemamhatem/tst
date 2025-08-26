# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SupplierDataComplete(Document):
    def on_submit(doc, method = None):
        # doc.reload()
        supplier_doc=frappe.get_doc("Supplier",doc.supplier)
        # supplier_doc.reload()
        if supplier_doc:
            # if not supplier_doc.supplier_name == doc.company:
            #     supplier_doc.supplier_name = doc.company
            if not supplier_doc.custom_contact_person_job_title == doc.job_title:
                supplier_doc.custom_contact_person_job_title = doc.job_title
            if not supplier_doc.custom_contact_person_email == doc.email:
                supplier_doc.custom_contact_person_email = doc.email
            if not supplier_doc.custom_contact_person_mobile_no == doc.mobile_number:
                supplier_doc.custom_contact_person_mobile_no = doc.mobile_number
            if not supplier_doc.custom_contact_person_name == doc.contact_person_name:
                supplier_doc.custom_contact_person_email = doc.email

            
            supplier_doc.save()
            if doc.address:
                address = frappe.new_doc("Address")
                address.address_title = doc.supplier   
                address.address_line1 = doc.address
                address.city = "Saudi"   
                address.town = "Saudi"   
                address.country = "Saudi Arabia"

                # Link to the supplier
                address.append("links", {
                    "link_doctype": "Supplier",
                    "link_name": doc.supplier
                })

                address.insert(ignore_permissions=True)            
            # supplier_doc.mobile_no = doc.phone_number
            frappe.db.set_value("Supplier",doc.supplier,"mobile_no",doc.phone_number)
            frappe.db.set_value("Supplier",doc.supplier,"supplier_primary_address",address.name)

        contact = frappe.get_doc("Contact",supplier_doc.supplier_primary_contact)
        

        if contact:

            # --- Handle phone numbers ---
            phone_exists = False
            for row in contact.phone_nos:
                if row.phone == doc.phone_number:
                    phone_exists = True
                    if not row.is_primary_mobile_no:
                        # make it primary if it's the same phone but not primary
                        row.is_primary_mobile_no = 1
                else:
                    # reset old primary
                    if row.is_primary_mobile_no:
                        row.is_primary_mobile_no = 0

            if not phone_exists:
                contact.append("phone_nos", {
                    "is_primary_mobile_no": 1,
                    "phone": doc.phone_number
                })

            # --- Handle emails ---
            email_exists = False
            for row in contact.email_ids:
                if row.email_id == doc.company_email:
                    email_exists = True
                    if not row.is_primary:
                        row.is_primary = 1
                else:
                    if row.is_primary:
                        row.is_primary = 0

            if not email_exists:
                contact.append("email_ids", {
                    "email_id": doc.company_email,
                    "is_primary": 1
                })

            contact.save()

        
            

            
            