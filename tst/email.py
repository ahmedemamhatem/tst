import frappe

@frappe.whitelist()
def send_quotation_with_signature(quotation_name, recipient):
    # Fetch Quotation document
    quotation = frappe.get_doc("Quotation", quotation_name)
    
    # 1. Get Quotation Template name from Quotation
    template_name = quotation.get("custom_quotation_templet")
    if not template_name:
        frappe.throw("No Quotation Template selected in Quotation.")
    
    # 2. Get Print Format from Quotation Template
    template = frappe.get_doc("Quotation Template", template_name)
    print_format = template.get("print_format")
    if not print_format:
        frappe.throw("No Print Format defined in Quotation Template.")
    
    # 3. Fetch Employee signature
    employee = frappe.get_all(
        "Employee", 
        filters={"user_id": frappe.session.user}, 
        fields=["custom_email_signature"]
    )
    signature = employee[0].custom_email_signature if employee and employee[0].custom_email_signature else ""
    
    # 4. Generate PDF with the chosen print format
    pdf_content = frappe.get_print(
        "Quotation",
        quotation.name,
        print_format=print_format,
        as_pdf=True
    )
    
    # 5. Compose and Send the Email
    subject = f"Quotation: {quotation.name}"
    message = f"Dear Customer,<br><br>Please find attached your quotation.<br><br>{signature}"
    
    frappe.sendmail(
        recipients=[recipient],
        subject=subject,
        message=message,
        attachments=[{
            "fname": f"{quotation.name}.pdf",
            "fcontent": pdf_content
        }]
    )
    return "Email sent successfully!"