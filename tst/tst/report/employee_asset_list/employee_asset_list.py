# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
    filters = filters or {}

    columns = [
        {"label": "Asset ID", "fieldname": "asset_id", "fieldtype": "Link", "options": "Asset", "width": 120},
        {"label": "Asset Name", "fieldname": "asset_name", "fieldtype": "Data", "width": 180},
        {"label": "Employee", "fieldname": "employee", "fieldtype": "Link", "options": "Employee", "width": 120},
        {"label": "Employee Name", "fieldname": "employee_name", "fieldtype": "Data", "width": 160},
        {"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 100},
        {"label": "Location", "fieldname": "location", "fieldtype": "Data", "width": 120},
    ]

    conditions = []
    values = {}

    if filters.get("employee"):
        conditions.append("a.custodian = %(employee)s")
        values["employee"] = filters["employee"]

    if filters.get("location"):
        conditions.append("a.location = %(location)s")
        values["location"] = filters["location"]

    if filters.get("status"):
        conditions.append("a.status = %(status)s")
        values["status"] = filters["status"]

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = "WHERE " + condition_str

    data = frappe.db.sql(f"""
        SELECT
            a.name as asset_id,
            a.asset_name,
            a.custodian as employee,
            emp.employee_name,
            a.status,
            a.location
        FROM `tabAsset` a
        LEFT JOIN `tabEmployee` emp ON a.custodian = emp.name
        {condition_str}
        ORDER BY a.custodian, a.location
    """, values, as_dict=1)

    return columns, data