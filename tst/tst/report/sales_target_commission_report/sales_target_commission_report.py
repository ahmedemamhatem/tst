# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt


def execute(filters=None):
    if not filters:
        filters = {}

    # Validate required filters
    if not filters.get("transaction_type"):
        filters["transaction_type"] = "Sales Order"
    if not filters.get("target_type"):
        filters["target_type"] = "Total Target Item Quantity"

    columns = get_columns(filters)
    data = get_data(filters)

    return columns, data


def get_columns(filters):
    """Define report columns based on target type."""
    target_type = filters.get("target_type")

    columns = [
        {
            "label": "Employee",
            "fieldname": "employee",
            "fieldtype": "Link",
            "options": "Employee",
            "width": 120,
        },
        {
            "label": "Employee Name",
            "fieldname": "employee_name",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "User ID",
            "fieldname": "user_id",
            "fieldtype": "Link",
            "options": "User",
            "width": 120,
        },
        {
            "label": "Full Name",
            "fieldname": "full_name",
            "fieldtype": "Data",
            "width": 150,
        },
    ]

    if target_type == "Total Target Item Quantity":
        columns.extend(
            [
                {
                    "label": "Target Quantity",
                    "fieldname": "target_value",
                    "fieldtype": "Float",
                    "width": 120,
                },
                {
                    "label": "Actual Quantity",
                    "fieldname": "actual_value",
                    "fieldtype": "Float",
                    "width": 120,
                },
                {
                    "label": "Variance (Qty)",
                    "fieldname": "variance",
                    "fieldtype": "Float",
                    "width": 120,
                },
                {
                    "label": "Achievement %",
                    "fieldname": "achievement_percent",
                    "fieldtype": "Percent",
                    "width": 120,
                },
            ]
        )
    elif target_type == "Total Target Item Selling amount":
        columns.extend(
            [
                {
                    "label": "Target Amount",
                    "fieldname": "target_value",
                    "fieldtype": "Currency",
                    "width": 120,
                },
                {
                    "label": "Actual Amount",
                    "fieldname": "actual_value",
                    "fieldtype": "Currency",
                    "width": 120,
                },
                {
                    "label": "Variance (Amount)",
                    "fieldname": "variance",
                    "fieldtype": "Currency",
                    "width": 120,
                },
                {
                    "label": "Achievement %",
                    "fieldname": "achievement_percent",
                    "fieldtype": "Percent",
                    "width": 120,
                },
            ]
        )
    elif target_type == "Sales Target By Item":
        columns.extend(
            [
                {
                    "label": "Item",
                    "fieldname": "item_code",
                    "fieldtype": "Link",
                    "options": "Item",
                    "width": 120,
                },
                {
                    "label": "Item Name",
                    "fieldname": "item_name",
                    "fieldtype": "Data",
                    "width": 150,
                },
                {
                    "label": "Target Quantity",
                    "fieldname": "target_value",
                    "fieldtype": "Float",
                    "width": 120,
                },
                {
                    "label": "Actual Quantity",
                    "fieldname": "actual_value",
                    "fieldtype": "Float",
                    "width": 120,
                },
                {
                    "label": "Variance (Qty)",
                    "fieldname": "variance",
                    "fieldtype": "Float",
                    "width": 120,
                },
                {
                    "label": "Achievement %",
                    "fieldname": "achievement_percent",
                    "fieldtype": "Percent",
                    "width": 120,
                },
            ]
        )

    return columns


def get_data(filters):
    """Get report data based on filters."""
    transaction_type = filters.get("transaction_type", "Sales Order")
    target_type = filters.get("target_type", "Total Target Item Quantity")
    employee_filter = filters.get("employee")

    # Get all Sales Target Commission records
    target_filters = {}
    if employee_filter:
        target_filters["employee"] = employee_filter

    target_records = frappe.get_all(
        "Sales Target Commission",
        filters=target_filters,
        fields=[
            "name",
            "employee",
            "employee_name",
            "user_id",
            "full_name",
            "total_target_item_quantity",
            "total_target_item_selling_amount",
        ],
    )

    if not target_records:
        return []

    data = []

    try:
        for target_record in target_records:
            user_id = target_record.user_id

            if not user_id:
                continue

            if target_type == "Sales Target By Item":
                # Get item-wise targets and actuals
                item_targets = frappe.get_all(
                    "Sales Target By Item",
                    filters={"parent": target_record.name},
                    fields=["item", "item_name", "target_quantity"],
                )

                for item_target in item_targets:
                    actual_qty = get_actual_item_quantity(
                        user_id, item_target.item, transaction_type, filters
                    )
                    variance = flt(actual_qty) - flt(item_target.target_quantity)
                    achievement_percent = (
                        (flt(actual_qty) / flt(item_target.target_quantity) * 100)
                        if flt(item_target.target_quantity) > 0
                        else 0
                    )

                    data.append(
                        {
                            "employee": target_record.employee,
                            "employee_name": target_record.employee_name,
                            "user_id": target_record.user_id,
                            "full_name": target_record.full_name,
                            "item_code": item_target.item,
                            "item_name": item_target.item_name,
                            "target_value": item_target.target_quantity,
                            "actual_value": actual_qty,
                            "variance": variance,
                            "achievement_percent": achievement_percent,
                        }
                    )
            else:
                # Get aggregated actuals for the employee
                if target_type == "Total Target Item Quantity":
                    target_value = target_record.total_target_item_quantity
                    actual_value = get_actual_total_quantity(
                        user_id, transaction_type, filters
                    )
                else:  # Total Target Item Selling amount
                    target_value = target_record.total_target_item_selling_amount
                    actual_value = get_actual_total_amount(
                        user_id, transaction_type, filters
                    )

                variance = flt(actual_value) - flt(target_value)
                achievement_percent = (
                    (flt(actual_value) / flt(target_value) * 100)
                    if flt(target_value) > 0
                    else 0
                )

                data.append(
                    {
                        "employee": target_record.employee,
                        "employee_name": target_record.employee_name,
                        "user_id": target_record.user_id,
                        "full_name": target_record.full_name,
                        "target_value": target_value,
                        "actual_value": actual_value,
                        "variance": variance,
                        "achievement_percent": achievement_percent,
                    }
                )

    except Exception as e:
        frappe.log_error(f"Error in Sales Target Commission Report: {str(e)}")
        frappe.throw(f"Error generating report: {str(e)}")

    return data


def get_actual_total_quantity(user_id, transaction_type, filters=None):
    """Get total quantity from transactions for a user."""
    try:
        doctype = transaction_type
        conditions = ["owner = %s", "docstatus = 1"]
        values = [user_id]

        # Add date filters if provided
        if filters:
            if filters.get("from_date"):
                conditions.append("posting_date >= %s")
                values.append(filters["from_date"])
            if filters.get("to_date"):
                conditions.append("posting_date <= %s")
                values.append(filters["to_date"])

        where_clause = " AND ".join(conditions)

        result = frappe.db.sql(
            f"""
            SELECT COALESCE(SUM(total_qty), 0)
            FROM `tab{doctype}`
            WHERE {where_clause}
        """,
            values,
        )

        return flt(result[0][0]) if result else 0
    except Exception:
        return 0


def get_actual_total_amount(user_id, transaction_type, filters=None):
    """Get total amount from transactions for a user."""
    try:
        doctype = transaction_type
        conditions = ["owner = %s", "docstatus = 1"]
        values = [user_id]

        # Add date filters if provided
        if filters:
            if filters.get("from_date"):
                conditions.append("posting_date >= %s")
                values.append(filters["from_date"])
            if filters.get("to_date"):
                conditions.append("posting_date <= %s")
                values.append(filters["to_date"])

        where_clause = " AND ".join(conditions)

        result = frappe.db.sql(
            f"""
            SELECT COALESCE(SUM(grand_total), 0)
            FROM `tab{doctype}`
            WHERE {where_clause}
        """,
            values,
        )

        return flt(result[0][0]) if result else 0
    except Exception:
        return 0


def get_actual_item_quantity(user_id, item_code, transaction_type, filters=None):
    """Get quantity for a specific item from transactions for a user."""
    try:
        item_doctype = f"{transaction_type} Item"
        conditions = ["t.owner = %s", "ti.item_code = %s", "t.docstatus = 1"]
        values = [user_id, item_code]

        # Add date filters if provided
        if filters:
            if filters.get("from_date"):
                conditions.append("t.posting_date >= %s")
                values.append(filters["from_date"])
            if filters.get("to_date"):
                conditions.append("t.posting_date <= %s")
                values.append(filters["to_date"])

        where_clause = " AND ".join(conditions)

        result = frappe.db.sql(
            f"""
            SELECT COALESCE(SUM(ti.qty), 0)
            FROM `tab{item_doctype}` ti
            INNER JOIN `tab{transaction_type}` t ON ti.parent = t.name
            WHERE {where_clause}
        """,
            values,
        )

        return flt(result[0][0]) if result else 0
    except Exception:
        return 0
