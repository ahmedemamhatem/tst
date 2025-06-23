import frappe
from frappe.utils import flt
import erpnext
from frappe import _


import json
from collections import defaultdict
from typing import TYPE_CHECKING, Union

from frappe.model.docstatus import DocStatus
from frappe.utils import cint

if TYPE_CHECKING:
    from frappe.model.document import Document
    from frappe.workflow.doctype.workflow.workflow import Workflow

from frappe.model.workflow import (
    get_workflow,
    get_transitions,
    has_approval_access,
    is_transition_condition_satisfied,
    send_email_alert,
)


import frappe
from frappe import _
from frappe.utils import flt

def monkey_patch_reorder_item():
    import erpnext.stock.reorder_item
    import frappe.model.workflow

    frappe.model.workflow.apply_workflow = apply_workflow
    erpnext.stock.reorder_item._reorder_item = _reorder_item

import frappe
from frappe.utils import flt


def validate_quotation_discount_limits(doc, method=None):
    template_name = doc.custom_quotation_templet
    if not template_name:
        return

    settings = frappe.get_single("TST Selling Settings")
    user_discount_role = settings.user_discount_role
    supervisor_discount_role = settings.supervisor_discount_role
    manager_discount_role = settings.manager_discount_role

    # Ensure user and supervisor roles are set
    if not (user_discount_role and supervisor_discount_role):
        frappe.throw(
            "Please set <b>User Discount Role</b> and <b>Supervisor Discount Role</b> in <b>TST Selling Settings</b>."
        )

    user_roles = frappe.get_roles(frappe.session.user)

    for item in doc.items:
        discount = flt(item.discount_percentage)

        if discount <= 0:
            continue

        # --- Manager override only if role is set and user has it ---
        if manager_discount_role and manager_discount_role in user_roles:
            continue

        # --- Fetch discount limits from template ---
        template_item = frappe.db.get_value(
            "Quotation Templet Item",
            {"parent": template_name, "item_code": item.item_code},
            ["user_discount", "supervisor_discount"],
            as_dict=True,
        )

        if not template_item:
            frappe.throw(
                f"Row {item.idx}: Missing discount limits for item <b>{item.item_code}</b> in Quotation Template <b>{template_name}</b>.<br>"
                "Please contact your administrator to set the limits."
            )

        user_limit = flt(template_item.get("user_discount"))
        supervisor_limit = flt(template_item.get("supervisor_discount"))

        # --- Validate Discount Logic ---

        # Case 1: Discount exceeds supervisor limit
        if supervisor_limit and discount > supervisor_limit:
            frappe.throw(
                f"Row {item.idx}: Discount <b>{discount}%</b> exceeds supervisor limit <b>{supervisor_limit}%</b> "
                f"for item <b>{item.item_code}</b>."
            )

        # Case 2: Discount exceeds user limit (needs supervisor)
        if user_limit and discount > user_limit:
            if supervisor_discount_role not in user_roles:
                frappe.throw(
                    f"Row {item.idx}: Discount <b>{discount}%</b> exceeds user limit <b>{user_limit}%</b> for item <b>{item.item_code}</b>. "
                    f"You need the <b>{supervisor_discount_role}</b> role."
                )

        # Case 3: Discount within user limit (needs user or supervisor)
        elif user_limit and discount <= user_limit:
            if (
                user_discount_role not in user_roles
                and supervisor_discount_role not in user_roles
            ):
                frappe.throw(
                    f"Row {item.idx}: Discount <b>{discount}%</b> requires either <b>{user_discount_role}</b> or <b>{supervisor_discount_role}</b> role."
                )

        # Case 4: Only supervisor limit set (no user limit)
        elif not user_limit and supervisor_limit:
            if supervisor_discount_role not in user_roles:
                frappe.throw(
                    f"Row {item.idx}: Discount <b>{discount}%</b> requires the <b>{supervisor_discount_role}</b> role."
                )


def _reorder_item():
    material_requests = {
        "Purchase": {},
        "Transfer": {},
        "Material Issue": {},
        "Manufacture": {},
    }
    warehouse_company = frappe._dict(
        frappe.db.sql(
            """select name, company from `tabWarehouse`
            where disabled=0"""
        )
    )
    default_company = (
        erpnext.get_default_company()
        or frappe.db.sql("""select name from tabCompany limit 1""")[0][0]
    )

    items_to_consider = get_items_for_reorder()
    if not items_to_consider:
        return

    item_warehouse_projected_qty = get_item_warehouse_projected_qty(items_to_consider)

    def add_to_material_request(**kwargs):
        if isinstance(kwargs, dict):
            kwargs = frappe._dict(kwargs)

        if kwargs.warehouse not in warehouse_company:
            return

        reorder_level = flt(kwargs.reorder_level)
        reorder_qty = flt(kwargs.reorder_qty)

        if kwargs.warehouse_group:
            projected_qty = flt(
                item_warehouse_projected_qty.get(kwargs.item_code, {}).get(
                    kwargs.warehouse_group
                )
            )
        else:
            projected_qty = flt(
                item_warehouse_projected_qty.get(kwargs.item_code, {}).get(
                    kwargs.warehouse
                )
            )

        if (reorder_level or reorder_qty) and projected_qty <= reorder_level:
            deficiency = reorder_level - projected_qty
            if deficiency > reorder_qty:
                reorder_qty = deficiency

            company = warehouse_company.get(kwargs.warehouse) or default_company

            mr_item = {
                "item_code": kwargs.item_code,
                "warehouse": kwargs.warehouse,
                "reorder_qty": reorder_qty,
                "item_details": kwargs.item_details,
            }

            if kwargs.material_request_type == "Transfer":
                try:
                    wh_doc = frappe.get_doc("Warehouse", kwargs.warehouse)
                    default_source = wh_doc.get("custom_default_source_warehouse")
                    if default_source:
                        mr_item["from_warehouse"] = default_source
                except Exception as e:
                    frappe.log_error(
                        f"Error fetching custom source warehouse for {kwargs.warehouse}: {e}"
                    )

            material_requests[kwargs.material_request_type].setdefault(
                company, []
            ).append(mr_item)

    for item_code, reorder_levels in items_to_consider.items():
        for d in reorder_levels:
            if d.has_variants:
                continue

            add_to_material_request(
                item_code=item_code,
                warehouse=d.warehouse,
                reorder_level=d.warehouse_reorder_level,
                reorder_qty=d.warehouse_reorder_qty,
                material_request_type=d.material_request_type,
                warehouse_group=d.warehouse_group,
                item_details=frappe._dict(
                    {
                        "item_code": item_code,
                        "name": item_code,
                        "item_name": d.item_name,
                        "item_group": d.item_group,
                        "brand": d.brand,
                        "description": d.description,
                        "stock_uom": d.stock_uom,
                        "purchase_uom": d.purchase_uom,
                        "lead_time_days": d.lead_time_days,
                    }
                ),
            )

def set_department_from_employee(doc, method):
    """
    Sets the 'department' field on a Material Request document before insert,
    based on the department of the Employee record linked to the current user.

    Uses raw SQL for fetching the department and includes error handling.

    Args:
        doc: The Material Request document being inserted.
        method: The event method name (not used here, but required by Frappe's doc event signature).

    Logs:
        Any exceptions encountered during execution will be logged to Frappe's error log.
    """
    try:
        current_user = frappe.session.user

        # Fetch the department from Employee using SQL
        result = frappe.db.sql(
            """
            SELECT department
            FROM `tabEmployee`
            WHERE user_id = %s
            LIMIT 1
            """,
            (current_user,),
            as_dict=True,
        )

        # Set department on the Material Request doc if found
        if result and result[0].get("department") and hasattr(doc, "department"):
            doc.department = result[0]["department"]

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "set_department_from_employee Error")


@frappe.whitelist()
def set_main_warehouse_qty(doc, method):
    """
    On Quotation validate, for each item in the items table, set
    'custom_main_warehouse_qty' with the qty of the item in the employee's
    'custom_main_warehouse'. The employee is matched where user_id = creator (doc.owner).
    If any value (employee, custom_main_warehouse, or item code) is missing, the row is skipped.

    Args:
        doc: The Quotation document being validated.
        method: The event method name (required by Frappe's doc event signature).

    Logs:
        Any exceptions are logged to Frappe's error log, but do not stop validation.
    """
    try:
        # Get the creator of the Quotation
        creator = doc.owner

        # Fetch Employee and custom_main_warehouse using SQL
        emp_result = frappe.db.sql(
            """
            SELECT name, `custom_main_warehouse`
            FROM `tabEmployee`
            WHERE user_id = %s
            LIMIT 1
            """,
            (creator,),
            as_dict=True,
        )
        if not emp_result or not emp_result[0].get("custom_main_warehouse"):
            # No employee or no custom_main_warehouse, skip all rows
            return

        custom_main_warehouse = emp_result[0]["custom_main_warehouse"]

        for row in doc.items:
            item_code = row.item_code
            if not item_code or not custom_main_warehouse:
                continue  # skip if missing

            # Get actual qty from Bin using SQL
            bin_result = frappe.db.sql(
                """
                SELECT actual_qty
                FROM `tabBin`
                WHERE item_code = %s AND warehouse = %s
                LIMIT 1
                """,
                (item_code, custom_main_warehouse),
                as_dict=True,
            )
            qty = (
                bin_result[0]["actual_qty"]
                if bin_result and bin_result[0].get("actual_qty") is not None
                else 0
            )
            row.custom_main_warehouse_qty = qty

    except Exception:
        frappe.log_error(frappe.get_traceback(), "set_main_warehouse_qty Error")

@frappe.whitelist()
def apply_workflow(doc, action):
    """Allow workflow action on the current doc"""
    frappe.msgprint(_("Applying Workflow Action"), alert=True)
    doc = frappe.get_doc(frappe.parse_json(doc))
    doc.load_from_db()
    workflow = get_workflow(doc.doctype)
    transitions = get_transitions(doc, workflow)
    user = frappe.session.user

    # find the transition
    transition = None
    for t in transitions:
        if t.action == action:
            transition = t

    if not transition:
        frappe.throw(_("Not a valid Workflow Action"), WorkflowTransitionError)

    if not has_approval_access(user, doc, transition):
        frappe.throw(_("Self approval is not allowed"))

    # update workflow state field
    doc.set(workflow.workflow_state_field, transition.next_state)

    # find settings for the next state
    next_state = next(d for d in workflow.states if d.state == transition.next_state)

    reports_to = ValidateReportsTo(doc)
    reports_to.validate_reports_to()
    # update any additional field
    if next_state.update_field:
        doc.set(next_state.update_field, next_state.update_value)

    new_docstatus = DocStatus(next_state.doc_status or 0)
    if doc.docstatus.is_draft() and new_docstatus.is_draft():
        doc.save()
    elif doc.docstatus.is_draft() and new_docstatus.is_submitted():
        from frappe.core.doctype.submission_queue.submission_queue import (
            queue_submission,
        )
        from frappe.utils.scheduler import is_scheduler_inactive

        if doc.meta.queue_in_background and not is_scheduler_inactive():
            queue_submission(doc, "Submit")
            return

        doc.submit()
    elif doc.docstatus.is_submitted() and new_docstatus.is_submitted():
        doc.save()
    elif doc.docstatus.is_submitted() and new_docstatus.is_cancelled():
        doc.cancel()
    else:
        frappe.throw(_("Illegal Document Status for {0}").format(next_state.state))

    doc.add_comment("Workflow", _(next_state.state))

    return doc


class ValidateReportsTo:
    def __init__(self, doc):
        self.doc = doc

    def validate_reports_to(self):
        # Get the language of the current user
        user_lang = frappe.db.get_value("User", frappe.session.user, "language")

        employee = frappe.db.exists("Employee", {"user_id": self.doc.owner})
        if not employee:
            return

        employee_doc = frappe.get_doc("Employee", employee)
        if not employee_doc.reports_to:
            return

        def get_allowed_users_to_approve(employee_doc):
            allowed_users_to_approve = []
            if employee_doc.reports_to:
                reports_to = frappe.get_doc("Employee", employee_doc.reports_to)
                if reports_to.user_id:
                    allowed_users_to_approve.append(reports_to.user_id)
                if reports_to.reports_to:
                    allowed_users_to_approve.extend(get_allowed_users_to_approve(reports_to))
            return allowed_users_to_approve

        allowed_users_to_approve = get_allowed_users_to_approve(employee_doc)
        if not allowed_users_to_approve:
            return
        if frappe.session.user not in allowed_users_to_approve:
            if user_lang == "ar":
                frappe.throw(
                    "أنت غير مصرح لك بالموافقة على هذا المستند. يرجى الاتصال بمديرك. المستخدم للموافقة: {0}".format(
                        frappe.bold(employee_doc.reports_to)
                    ),
                    title="خطأ في الصلاحيات",
                )
            else:
                frappe.throw(
                    _("You are not allowed to approve this document. Please contact your manager. User to approve: {0}").format(
                        frappe.bold(employee_doc.reports_to)
                    ),
                    title=_("Permission Error"),
                )


def alert_supervisor_on_item_shortfall(doc, method):
    """
    Alert the supervisor if any item in the Quotation exceeds available stock.
    """
    try:
        # Get the language of the current user
        user_lang = frappe.db.get_value("User", frappe.session.user, "language")

        creator = doc.owner

        # Fetch Employee with supervisor (reports_to)
        emp = frappe.db.get_value(
            "Employee", {"user_id": creator}, ["name", "reports_to"], as_dict=True
        )
        if not emp or not emp.get("reports_to"):
            return

        supervisor_user_id = frappe.db.get_value("Employee", emp["reports_to"], "user_id")
        if not supervisor_user_id:
            return

        # Gather all applicable shortfall items
        shortfall_rows = []
        for row in doc.items:
            req_qty = flt(row.qty or 0)
            avail_qty = flt(row.custom_main_warehouse_qty or 0)
            if req_qty > avail_qty > 0:
                shortfall_rows.append(
                    {
                        "item_code": row.item_code,
                        "item_name": row.item_name or "",
                        "qty": req_qty,
                        "available": avail_qty,
                    }
                )

        if not shortfall_rows:
            return

        # Build HTML table for email
        item_table = """
        <table border="1" cellpadding="4" cellspacing="0">
            <tr>
                <th>{}</th>
                <th>{}</th>
                <th>{}</th>
                <th>{}</th>
            </tr>
        """.format(
            _("Item Code") if user_lang != "ar" else "كود المنتج",
            _("Item Name") if user_lang != "ar" else "اسم المنتج",
            _("Requested Quantity") if user_lang != "ar" else "الكمية المطلوبة",
            _("Available in Main Warehouse") if user_lang != "ar" else "المتوفر في المستودع الرئيسي",
        )
        for r in shortfall_rows:
            item_table += f"""
                <tr>
                    <td>{frappe.utils.escape_html(r["item_code"])}</td>
                    <td>{frappe.utils.escape_html(r["item_name"])}</td>
                    <td>{r["qty"]}</td>
                    <td>{r["available"]}</td>
                </tr>
            """
        item_table += "</table>"

        if user_lang == "ar":
            subject = "تنبيه بنقص في العناصر: {0}".format(doc.name)
            message = f"""
            <p>عزيزي المشرف،</p>
            <p>العناصر التالية في عرض السعر <b>{doc.name}</b> الذي تم إنشاؤه بواسطة الموظف التابع لك (<b>{creator}</b>)
            تتجاوز المخزون المتوفر في المستودع الرئيسي ({len(shortfall_rows)} عنصر):</p>
            {item_table}
            <p>عرض السعر: <a href="{frappe.utils.get_url_to_form('Quotation', doc.name)}">{doc.name}</a></p>
            <p>يرجى المراجعة واتخاذ الإجراءات اللازمة.</p>
            """
        else:
            subject = _("Quotation Item Shortfall Alert: {0}").format(doc.name)
            message = f"""
            <p>Dear Supervisor,</p>
            <p>The following items in Quotation <b>{doc.name}</b> created by your reportee (<b>{creator}</b>)
            exceed the available stock in their main warehouse ({len(shortfall_rows)} item(s)):</p>
            {item_table}
            <p>Quotation: <a href="{frappe.utils.get_url_to_form('Quotation', doc.name)}">{doc.name}</a></p>
            <p>Please review and take necessary action.</p>
            """

        frappe.sendmail(
            recipients=[supervisor_user_id],
            subject=subject,
            message=message,
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), _("Error in alert_supervisor_on_item_shortfall"))


def validate_items_are_saleable(doc, method):
    """
    Validate that all items in the document are saleable.
    """
    # Get the language of the current user
    user_lang = frappe.db.get_value("User", frappe.session.user, "language")

    for item in doc.items:
        item_status = frappe.db.get_value("Item", item.item_code, "custom_item_status")
        if item_status and item_status != "Saleable":
            if user_lang == "ar":
                frappe.throw(
                    "العنصر {0} لا يمكن معالجته لأن حالته هي {1}".format(
                        frappe.bold(item.item_code), frappe.bold(item_status)
                    ),
                    title="حالة العنصر غير صالحة",
                )
            else:
                frappe.throw(
                    _("Item {0} cannot be processed because its status is {1}.").format(
                        frappe.bold(item.item_code), frappe.bold(item_status)
                    ),
                    title=_("Invalid Item Status"),
                )
