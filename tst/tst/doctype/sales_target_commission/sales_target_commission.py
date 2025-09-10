# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class SalesTargetCommission(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF
        from tst.tst.doctype.sales_target_by_item.sales_target_by_item import SalesTargetByItem

        employee: DF.Link | None
        employee_name: DF.Data | None
        full_name: DF.Data | None
        sales_target_by_item: DF.Table[SalesTargetByItem]
        total_target_item_quantity: DF.Float
        total_target_item_selling_amount: DF.Currency
        user_id: DF.Link | None
    # end: auto-generated types
    pass
