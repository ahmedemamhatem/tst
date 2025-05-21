import frappe
from frappe import _

@frappe.whitelist()
def validate(doc, method):
    """
    Validate the Purchase Order document.
    """
    if doc.grand_total <= 1000:
        doc.custom_po_types = "مشتريات استهلاكية"
    elif doc.grand_total > 1000 and doc.custom_po_types == "مشتريات استهلاكية":
        frappe.throw(_("Purchase Value must be less than 1000 to be considered as استهلاكية and have to create quotation" ))

    if doc.custom_po_types in ["مشتريات دولية", "مشتريات محلية"] and not doc.custom_quotation:
        frappe.throw(_("Please create a quotation for this Purchase Order"))


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