import frappe
from frappe import _
from datetime import datetime, timedelta

@frappe.whitelist()
def get_installation_orders_by_week(start_date=None, technician=None, customer=None):
    """Return a dict with 7 days as keys, each containing a list of installation orders sorted by scheduled_time."""
    if not start_date:
        return {}

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    except Exception:
        frappe.throw(_("Invalid start date format. Use 'YYYY-MM-DD'."))

    # Generate a list of ISO-formatted dates for the week
    week_dates = [(start + timedelta(days=i)).date().isoformat() for i in range(7)]

    # Build filters for the Installation Order query
    filters = [["installation_date", "between", [week_dates[0], week_dates[-1]]]]
    if technician:
        filters.append(["technician", "=", technician])
    if customer:
        filters.append(["customer", "=", customer])

    # Fetch installation orders
    orders = frappe.get_list(
        "Installation Order",
        fields=[
            "name", "installation_date", "scheduled_time", "customer", "customer_name", "customer_email",
            "technician", "warehouse", "sales_order", "docstatus"
        ],
        filters=filters,
        order_by="installation_date asc, scheduled_time asc"
    )

    # Attach items for each order
    for order in orders:
        order["items"] = frappe.get_all(
            "Installation Order Item",
            filters={"parent": order["name"]},
            fields=["item_code", "item_name", "description", "qty", "uom"]
        )

    # Group orders by installation_date and normalize scheduled_time
    result = {day: [] for day in week_dates}
    for order in orders:
        date = str(order["installation_date"])
        if date in result:
            # Normalize scheduled_time as a datetime.time object
            order["normalized_scheduled_time"] = normalize_scheduled_time(order.get("scheduled_time"))
            result[date].append(order)

    # Sort orders for each day by normalized_scheduled_time
    for day in result:
        result[day].sort(key=lambda x: x.get("normalized_scheduled_time") or datetime.min.time())

    return result


def normalize_scheduled_time(scheduled_time):
    """
    Normalize scheduled_time to a datetime.time object.
    Handles cases where scheduled_time is a string, datetime.datetime, or None.
    """
    if isinstance(scheduled_time, datetime):
        return scheduled_time.time()  # Extract time from datetime
    elif isinstance(scheduled_time, str):
        try:
            # Parse time from string (assuming "HH:MM:SS" format)
            return datetime.strptime(scheduled_time, "%H:%M:%S").time()
        except ValueError:
            pass  # Ignore invalid time strings
    return None  # Return None if scheduled_time is invalid or missing


@frappe.whitelist()
def move_installation_order(order_name, new_date):
    """Update the installation_date and preserve the time part of scheduled_time."""
    doc = frappe.get_doc("Installation Order", order_name)

    # Default scheduled_time if not set
    time_str = "12:00:00"
    if doc.scheduled_time:
        if isinstance(doc.scheduled_time, datetime):
            time_str = doc.scheduled_time.time().strftime("%H:%M:%S")
        elif isinstance(doc.scheduled_time, str):
            # Extract time from string if valid
            time_str = str(doc.scheduled_time).split(" ")[1] if " " in str(doc.scheduled_time) else "12:00:00"

    # Update installation_date and preserve time
    doc.installation_date = new_date
    doc.scheduled_time = f"{new_date} {time_str}"
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}


@frappe.whitelist()
def update_order_fields(order_name, technician=None, scheduled_time=None, sub_technicians=None):
    """Update technician, scheduled_time, and sub_technicians child table for an Installation Order."""
    import json
    doc = frappe.get_doc("Installation Order", order_name)

    # Update technician
    if technician is not None:
        doc.technician = technician

    # Update scheduled_time
    if scheduled_time is not None:
        try:
            # Convert to datetime if it's a string
            if isinstance(scheduled_time, str):
                scheduled_time = datetime.strptime(scheduled_time, "%Y-%m-%d %H:%M:%S")
            doc.scheduled_time = scheduled_time
        except ValueError:
            frappe.throw(_("Invalid scheduled time format. Use 'YYYY-MM-DD HH:MM:SS'."))

    # Update sub_technicians child table
    if sub_technicians is not None:
        sub_tech_list = json.loads(sub_technicians) if isinstance(sub_technicians, str) else sub_technicians
        doc.set("sub_technicians", [])
        for row in sub_tech_list:
            doc.append("sub_technicians", row)

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}