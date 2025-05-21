import frappe
from frappe.query_builder import DocType
from frappe.query_builder.functions import Count
from pypika.terms import Case

def execute(filters=None):
    columns = [
        {"label": "Item", "fieldname": "item_code", "fieldtype": "Link", "options": "Item"},
        {"label": "Item Name", "fieldname": "item_name", "fieldtype": "Data", "width": 200},
        {"label": "Occurences In Month", "fieldname": "occurrences", "fieldtype": "Float"},
    ]
    PurchaseOrder = DocType("Purchase Order")
    PurchaseOrderItem = DocType("Purchase Order Item")
    
    if filters.get("from_date"):
        from_date = filters.get("from_date")
    else:
        from_date = frappe.utils.get_first_day(frappe.utils.nowdate())
    if filters.get("to_date"):
        to_date = filters.get("to_date")
    else:
        to_date = frappe.utils.get_last_day(frappe.utils.nowdate())
    if filters.get("occurrences"):
        occurrences = filters.get("occurrences")
    else:
        occurrences = 3
    query = (
        frappe.qb.from_(PurchaseOrder)
        .join(PurchaseOrderItem)
        .on(PurchaseOrder.name == PurchaseOrderItem.parent)
        .select(PurchaseOrderItem.item_code, PurchaseOrderItem.item_name)
        .select(Count(PurchaseOrderItem.item_code).as_("occurrences"))
        .where(PurchaseOrder.docstatus == 1)
        .where(PurchaseOrder.transaction_date >= from_date)
        .where(PurchaseOrder.transaction_date <= to_date)
        .groupby(PurchaseOrderItem.item_code, PurchaseOrderItem.item_name)
        .orderby(Count(PurchaseOrderItem.item_code), order=frappe.qb.desc)
        .having(Count(PurchaseOrderItem.item_code) > occurrences)
    )
    
    result = query.run(as_dict=True)
    
    if not result:
        return columns, []

    return columns, result