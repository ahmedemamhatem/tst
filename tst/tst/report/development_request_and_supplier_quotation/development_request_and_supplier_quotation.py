import frappe

def execute(filters=None):
    # Ensure the Development Request filter is provided
    if not filters or not filters.get("development_request"):
        frappe.throw("Development Request is a mandatory filter.")

    # Columns for the report
    columns = get_columns(filters)

    # Data for the report
    data = get_data(filters)

    return columns, data

def get_columns(filters):
    # Base columns for Development Request details
    columns = [
        {"label": "Development Request", "fieldname": "development_request", "fieldtype": "Link", "options": "Development Request", "width": 200},
        {"label": "Customer", "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 150},
        {"label": "Request Priority", "fieldname": "request_priority", "fieldtype": "Data", "width": 120},
        {"label": "Request Type", "fieldname": "request_type", "fieldtype": "Data", "width": 120},
        {"label": "Request Date", "fieldname": "request_date", "fieldtype": "Date", "width": 120},
    ]

    # Fetch suppliers for the selected Development Request
    suppliers = frappe.db.get_all(
        "Supplier Communication",
        distinct=True,
        fields=["supplier"],
        filters={"development_request": filters.get("development_request")},
        order_by="supplier"
    )

    # Add supplier columns dynamically
    for supplier in suppliers:
        columns.append({
            "label": supplier.supplier,
            "fieldname": frappe.scrub(supplier.supplier),
            "fieldtype": "Data",  # Use Data fieldtype to allow HTML rendering
            "width": 150
        })

    return columns

def get_data(filters):
    # Fetch Development Request details
    development_request = filters.get("development_request")
    development_requests = frappe.db.sql("""
        SELECT 
            name AS development_request, 
            customer, 
            request_priority, 
            request_type, 
            request_date
        FROM `tabDevelopment Request`
        WHERE name = %(development_request)s
    """, {
        "development_request": development_request
    }, as_dict=True)

    # Initialize data
    data = []

    for request in development_requests:
        row = {
            "development_request": request.development_request,
            "customer": request.customer,
            "request_priority": request.request_priority,
            "request_type": request.request_type,
            "request_date": request.request_date,
        }

        # Fetch supplier quotations for the selected Development Request
        supplier_communications = frappe.db.sql("""
            SELECT supplier, quotation_amount
            FROM `tabSupplier Communication`
            WHERE development_request = %s
            ORDER BY quotation_amount ASC
        """, (request.development_request,), as_dict=True)

        # Find the minimum and maximum quotation amounts
        if supplier_communications:
            min_quotation = min(supplier_communications, key=lambda x: x["quotation_amount"])
            max_quotation = max(supplier_communications, key=lambda x: x["quotation_amount"])

            # Populate supplier data and apply color formatting
            for communication in supplier_communications:
                supplier_key = frappe.scrub(communication.supplier)
                amount = communication.quotation_amount

                # Apply green for minimum and red for maximum
                if communication["supplier"] == min_quotation["supplier"]:
                    row[supplier_key] = f'<span style="color: green; font-weight: bold;">{amount:,.2f}</span>'
                elif communication["supplier"] == max_quotation["supplier"]:
                    row[supplier_key] = f'<span style="color: red; font-weight: bold;">{amount:,.2f}</span>'
                else:
                    row[supplier_key] = f'{amount:,.2f}'

        data.append(row)

    return data