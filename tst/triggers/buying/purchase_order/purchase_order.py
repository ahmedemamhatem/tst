import frappe
from frappe import _


@frappe.whitelist()
def validate(doc, method):
    """
    Validate the Purchase Order document.
    """
    # Fetch the current user's language
    user_lang = frappe.db.get_value("User", frappe.session.user, "language")

    # Value check for استهلاكية
    if doc.grand_total > 1000 and (
        doc.custom_po_types == "مشتريات استهلاكية" or not doc.custom_po_types
    ):
        if user_lang == "ar":
            frappe.throw(
                "يجب أن تكون قيمة الشراء أقل من 1000 لتعتبر كاستهلاكية ويجب إنشاء عرض سعر أو اختيار نوع شراء آخر."
            )
        else:
            frappe.throw(
                "Purchase Value must be less than 1000 to be considered as استهلاكية and you must create a quotation or choose another Purchase Type."
            )

    # Check if PO Type mandates supplier quotation
    if doc.custom_po_types:
        po_type_doc = frappe.get_doc("PO Types", doc.custom_po_types)

        if po_type_doc.supplier_quotation_mandatory == 1:
            for item in doc.items:
                if not item.supplier_quotation:
                    if user_lang == "ar":
                        frappe.throw(
                            "يرجى التأكد من أن كل صف في العناصر يحتوي على عرض سعر محدد لأمر الشراء هذا."
                        )
                    else:
                        frappe.throw(
                            "Please ensure every item row has a Quotation specified for this Purchase Order."
                        )

    # Supplier country and internal PO type check
    if doc.supplier and doc.custom_po_types:
        po_type_doc = frappe.get_doc("PO Types", doc.custom_po_types)
        supplier_doc = frappe.get_doc("Supplier", doc.supplier)

        if supplier_doc.country == "Saudi Arabia" and po_type_doc.is_internal == 0:
            if user_lang == "ar":
                frappe.throw(
                    "بالنسبة للموردين داخل السعودية، يجب أن يكون نوع أمر الشراء محدداً كداخلي."
                )
            else:
                frappe.throw(
                    "For suppliers in Saudi Arabia, PO Type must be marked as Internal."
                )

        if po_type_doc.is_internal == 1 and supplier_doc.country != "Saudi Arabia":
            if user_lang == "ar":
                frappe.throw(
                    "بالنسبة للموردين خارج السعودية، لا يمكن أن يكون نوع أمر الشراء داخلياً."
                )
            else:
                frappe.throw(
                    "For suppliers outside Saudi Arabia, PO Type cannot be marked as Internal."
                )


@frappe.whitelist()
def on_update_after_submit(doc, method):
    """
    Trigger email sending after the Purchase Order is updated and submitted.
    """
    send_invoices_email(doc)


def send_invoices_email(doc):
    """
    Send an email with invoice attachments to the document owner.
    """
    # Fetch the current user's language
    user_lang = frappe.db.get_value("User", frappe.session.user, "language")

    receiver = doc.owner
    attachments = []

    # Collect all unsent invoices
    for row in doc.custom_purchase_invoices_attachment:
        if not row.sent:
            attachments.append(row.purchase_invoice)
            row.sent = 1

    # Send email if there is a receiver
    if receiver:
        try:
            frappe.sendmail(
                subject=_("Invoice Attachments")
                if user_lang != "ar"
                else "مرفقات الفواتير",
                recipients=[receiver],
                template="inv_attachments",
                args={
                    "docinfo": doc,
                    "attachments": attachments,
                    "receiver": receiver,
                },
            )
            frappe.msgprint(
                _("Email sent successfully!")
                if user_lang != "ar"
                else "تم إرسال البريد الإلكتروني بنجاح!"
            )
        except Exception as e:
            frappe.log_error(
                message=f"Failed to send email: {str(e)}", title="Email Error"
            )
            if user_lang == "ar":
                frappe.throw(
                    "حدث خطأ أثناء إرسال البريد الإلكتروني. يرجى التحقق من السجلات."
                )
            else:
                frappe.throw(
                    "An error occurred while sending the email. Please check the logs."
                )
