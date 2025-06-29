import frappe
import re

@frappe.whitelist()
def create_wh_massage_with_attachment(quotation_name, doctype):
    user = frappe.session.user

    # Get Employee info
    employee = frappe.get_all(
        "Employee", filters={"user_id": user}, fields=["cell_number", "custom_email_signature"]
    )
    if not employee or not employee[0].cell_number:
        frappe.throw("يرجى تحديث رقم الجوال في ملف الموظف مع رمز الدولة.")
    cell_number = employee[0].cell_number.strip()

    # Validate phone number
    import re
    if not re.fullmatch(r"\+\d{10,15}", cell_number):
        frappe.throw("يرجى تحديث رقم الجوال في ملف الموظف مع رمز الدولة (مثال: +9665xxxxxxx).")

    employee_signature = employee[0].custom_email_signature or ""

    # Get Quotation and customer name
    quotation = frappe.get_doc(doctype, quotation_name)
    customer_name = getattr(quotation, "customer_name", None) or getattr(quotation, "customer", "")

    template_name = quotation.get("custom_quotation_templet")
    if not template_name:
        frappe.throw("لا يوجد قالب عرض أسعار محدد.")
    template = frappe.get_doc("Quotation Template", template_name)
    print_format = template.get("print_format")
    if not print_format:
        frappe.throw("لا يوجد نموذج طباعة محدد في قالب عرض الأسعار.")

    # Prepare message: Dear customer, DocType, Doc Name, Signature
    full_message = (
        f"عميلنا العزيز {customer_name}\n\n"
        f"نوع المستند: {doctype}\n"
        f"رقم المستند: {quotation_name}\n\n"
        f"{employee_signature}"
    )

    # Generate PDF
    pdf_content = frappe.get_print(
        doctype, quotation_name, print_format=print_format, as_pdf=True
    )

    # Create WH Massage
    wh_massage = frappe.new_doc("WH Massage")
    wh_massage.phone = cell_number
    wh_massage.send_message = full_message
    wh_massage.reference_doctype = doctype
    wh_massage.reference_name = quotation_name
    wh_massage.status = "Pending"
    wh_massage.type = "out"
    wh_massage.insert()

    # Attach PDF to WH Massage
    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": f"{quotation_name}.pdf",
        "attached_to_doctype": "WH Massage",
        "attached_to_name": wh_massage.name,
        "content": pdf_content,
        "is_private": 1,
    })
    file_doc.save(ignore_permissions=True)

    # Add file link to WH Massage
    wh_massage.file = file_doc.file_url
    wh_massage.save(ignore_permissions=True)
    wh_massage.submit()

    return {
        "msg": "تم إنشاء رسالة الواتساب بنجاح مع إرفاق عرض السعر.",
        "wh_massage_name": wh_massage.name,
        "file_url": file_doc.file_url,
    }