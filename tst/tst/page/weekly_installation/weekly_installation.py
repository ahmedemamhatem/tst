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
        return {}

    week_dates = [(start + timedelta(days=i)).date().isoformat() for i in range(7)]

    filters = [
        ["installation_date", "between", [week_dates[0], week_dates[-1]]]
    ]
    if technician:
        filters.append(["technician", "=", technician])
    if customer:
        filters.append(["customer", "=", customer])

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

    # Group by installation_date
    result = {day: [] for day in week_dates}
    for order in orders:
        date = str(order["installation_date"])
        if date in result:
            result[date].append(order)

    # Sort each day by scheduled_time (if not already done by SQL)
    for day in result:
        result[day].sort(key=lambda x: x.get("scheduled_time") or "")

    return result

@frappe.whitelist()
def move_installation_order(order_name, new_date):
    doc = frappe.get_doc("Installation Order", order_name)
    # scheduled_time can be None, string, or datetime.datetime
    from datetime import datetime

    # Default time if not set
    time_str = "12:00:00"
    if doc.scheduled_time:
        if isinstance(doc.scheduled_time, datetime):
            time_str = doc.scheduled_time.time().strftime("%H:%M:%S")
        else:
            # fallback if somehow it's still a string
            time_str = str(doc.scheduled_time).split(" ")[1] if " " in str(doc.scheduled_time) else "12:00:00"
    # Set new installation_date
    doc.installation_date = new_date
    # Set new scheduled_time (date part changed, time part preserved)
    doc.scheduled_time = f"{new_date} {time_str}"
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}

import frappe

@frappe.whitelist()
def update_order_fields(order_name, technician=None, scheduled_time=None, sub_technicians=None):
    import json
    doc = frappe.get_doc("Installation Order", order_name)
    if technician is not None:
        doc.technician = technician
    if scheduled_time is not None:
        doc.scheduled_time = scheduled_time
    # Update sub_technicians child table (replace with your actual fieldname if different)
    if sub_technicians is not None:
        sub_tech_list = json.loads(sub_technicians) if isinstance(sub_technicians, str) else sub_technicians
        doc.set("sub_technicians", [])
        for row in sub_tech_list:
            doc.append("sub_technicians", row)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}