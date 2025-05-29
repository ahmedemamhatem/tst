import frappe
from frappe import _

@frappe.whitelist()
def validate(doc, method):
    """
    Validate the Purchase Order document.
    """
    # Value check for استهلاكية
    if doc.grand_total > 1000 and (doc.custom_po_types == "مشتريات استهلاكية" or not doc.custom_po_types):
        frappe.throw(_("Purchase Value must be less than 1000 to be considered as استهلاكية and have to create quotation\
                       or choose another purchase Type" ))

    # Check if PO Type mandates supplier quotation
    if doc.custom_po_types:
        po_type_doc = frappe.get_doc("PO Types", doc.custom_po_types)  

        if po_type_doc.supplier_quotation_mandatory == 1:
            for item in doc.items:
                if not item.supplier_quotation:
                    frappe.throw(_("Please ensure every item row has a Quotation specified for this Purchase Order."))

    # supplier country and internal PO type check
    
    if doc.supplier and doc.custom_po_types:
        o_type_doc = frappe.get_doc("PO Types", doc.custom_po_types)  
        supplier_doc = frappe.get_doc("Supplier", doc.supplier)
        
        if supplier_doc.country == "Saudi Arabia" and po_type_doc.is_internal == 0:
            frappe.throw(_("For suppliers in Saudi Arabia, PO Type must be marked as Internal."))
        if po_type_doc.is_internal == 1 and supplier_doc.country != "Saudi Arabia":
            frappe.throw(_("For suppliers outside Saudi Arabia, PO Type must be marked as Internal."))

@frappe.whitelist()
def on_update_after_submit(doc, method):
    send_invoices_email(doc)


def send_invoices_email(doc):
    receiver = doc.owner
    attachments = []
    for row in doc.custom_purchase_invoices_attachment:
        if not row.sent:
            attachments.append(row.purchase_invoice)
            row.sent = 1


    if receiver:
        frappe.sendmail(
            subject=_("Invoice Attachments"),
            recipients=[receiver],
            template="inv_attachments",
            args={
                "docinfo": doc,
                "attachments": attachments,
                "receiver": receiver,
            },
        )