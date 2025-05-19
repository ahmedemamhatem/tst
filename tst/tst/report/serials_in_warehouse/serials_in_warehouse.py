import frappe


def execute(filters=None):
    filters = filters or {}

    columns = [
        {
            "label": "Serial No",
            "fieldname": "serial_no",
            "fieldtype": "Link",
            "options": "Serial No",
            "width": 130,
        },
        {
            "label": "Item",
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 130,
        },
        {
            "label": "Purchase Document",
            "fieldname": "purchase_document_no",
            "fieldtype": "Link",
            "options": "Purchase Receipt",
            "width": 130,
        },
        {
            "label": "Purchase Date",
            "fieldname": "creation",
            "fieldtype": "Date",
            "width": 110,
        },
        {
            "label": "Current Warehouse",
            "fieldname": "warehouse",
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 130,
        },
        {
            "label": "Last Delivery Note",
            "fieldname": "last_delivery_note",
            "fieldtype": "Link",
            "options": "Delivery Note",
            "width": 130,
        },
        {
            "label": "Last Delivery Date",
            "fieldname": "last_delivery_date",
            "fieldtype": "Date",
            "width": 110,
        },
    ]

    conditions = ["s.status = 'Active'"]
    values = {}

    if filters.get("item_code"):
        conditions.append("s.item_code = %(item_code)s")
        values["item_code"] = filters["item_code"]
    if filters.get("warehouse"):
        conditions.append("s.warehouse = %(warehouse)s")
        values["warehouse"] = filters["warehouse"]
    if filters.get("from_date"):
        conditions.append("s.creation >= %(from_date)s")
        values["from_date"] = filters["from_date"]
    if filters.get("to_date"):
        conditions.append("s.creation <= %(to_date)s")
        values["to_date"] = filters["to_date"]

    condition_str = " AND ".join(conditions)

    data = frappe.db.sql(
        f"""
        SELECT
            s.serial_no,
            s.item_code,
            s.purchase_document_no,
            s.creation,
            s.warehouse,
            (
                SELECT sdn.parent
                FROM `tabDelivery Note Item` sdn
                WHERE FIND_IN_SET(s.serial_no, sdn.serial_no)
                ORDER BY sdn.creation DESC
                LIMIT 1
            ) AS last_delivery_note,
            (
                SELECT dn.posting_date
                FROM `tabDelivery Note` dn
                WHERE dn.name = (
                    SELECT sdn.parent
                    FROM `tabDelivery Note Item` sdn
                    WHERE FIND_IN_SET(s.serial_no, sdn.serial_no)
                    ORDER BY sdn.creation DESC
                    LIMIT 1
                )
            ) AS last_delivery_date
        FROM `tabSerial No` s
        WHERE {condition_str}
        ORDER BY s.creation DESC, s.serial_no
    """,
        values,
        as_dict=1,
    )

    return columns, data
