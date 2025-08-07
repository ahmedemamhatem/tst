import os
import frappe
import pandas as pd
import io
from erpnext.stock.utils import get_stock_balance
from frappe import _
from tst.tst.doctype.device_setup.device_setup import DeviceSetup

def get_employee_fields_included_tabs():
    """Return a sorted list of Employee doctype fields in the specified tabs, excluding unwanted types."""
    INCLUDED_TABS = {
        "Overview",
        "Joining",
        "Address & Contacts",
        "Attendance & Leaves",
        "Salary",
        "Personal",
    }

    # These field types will be skipped
    EXCLUDED_FIELD_TYPES = (
        "Section Break",
        "Column Break",
        "Tab Break",
        "HTML",
        "Table",
        "Button",
        "Image",
        "Fold",
    )

    meta = frappe.get_meta("Employee")
    fields_in_tabs = []
    current_tab = None

    for f in meta.fields:
        if f.fieldtype == "Tab Break":
            current_tab = f.label
        if (
            f.fieldtype not in EXCLUDED_FIELD_TYPES
            and f.fieldname
            and current_tab in INCLUDED_TABS
        ):
            fields_in_tabs.append({
                "fieldname": f.fieldname,
                "label": f.label,
                "fieldtype": f.fieldtype,
                "tab": current_tab
            })

    return fields_in_tabs

    
@frappe.whitelist()
def get_repack_bom_details(repack_bom_name):
    if not frappe.has_permission("Repack BOM", "read"):
        frappe.throw("You do not have permission to access this resource.")

    # Fetch the Repack BOM document
    repack_bom = frappe.get_doc("Repack BOM", repack_bom_name)

    # Ensure the document exists
    if not repack_bom:
        frappe.throw(f"Repack BOM {repack_bom_name} not found.")

    # Prepare the response with main item and child items
    response = {
        "main_item": {
            "item_code": repack_bom.main_item,
            "qty": repack_bom.qty,
            "uom": repack_bom.uom,
            "default_warehouse": repack_bom.default_warehouse
        },
        "child_items": []
    }

    # Add child items from the BOM
    for child in repack_bom.table_wlal:
        conversion_factor = frappe.db.get_value(
            "UOM Conversion Detail",
            {"parent": child.item_code, "uom": child.uom},
            "conversion_factor"
        ) or 1  # Default to 1 if no conversion factor is found

        response["child_items"].append({
            "item_code": child.item_code,
            "qty": child.quantity,
            "uom": child.uom,
            "default_warehouse": child.default_warehouse,
            "conversion_factor": conversion_factor
        })

    return response


def set_custom_creator(doc, method):
    if doc.owner:
        user = frappe.get_doc("User", doc.owner)
        if user.full_name:
            doc.custom_creator = user.full_name


def update_custom_creator():
    update_custom_creator_for_doctype("Lead")
    update_custom_creator_for_doctype("Quotation")


def update_custom_creator_for_doctype(doctype):
    print(f"Updating {doctype}...")
    docs = frappe.get_all(doctype, fields=["name", "owner"])
    updated_count = 0

    for d in docs:
        if d.owner:
            try:
                user = frappe.get_doc("User", d.owner)
                full_name = user.full_name or ""
                frappe.db.set_value(doctype, d.name, "custom_creator", full_name)
                updated_count += 1
            except Exception as e:
                print(f"Error for {doctype} {d.name}: {str(e)}")
        else:
            print(f"No owner for {doctype} {d.name}")

    frappe.db.commit()


def update_all_employee_percent():
    """
    Update the 'custom_fields_filled_percent' for all Employee records,
    and return a summary list (employee, percent, total, filled).
    """
    employees = frappe.get_all("Employee", pluck="name")
    results = []
    for emp in employees:
        doc = frappe.get_doc("Employee", emp)
        percent, total, filled = update_employee_percent(doc)
        doc.save(ignore_permissions=True)
        results.append(
            {"employee": emp, "percent": percent, "total": total, "filled": filled}
        )
    frappe.db.commit()
    return results


def update_employee_percent(doc, method=None):
    """
    For the given Employee doc, calculate the percent of fields filled
    for fields that are under certain Tab Breaks.
    Updates doc.custom_fields_filled_percent and returns (percent, total, filled).
    """
    # List the tabs you want to include (case, spacing, and spelling must match exactly)
    INCLUDED_TABS = {
        "Overview",
        "Joining",
        "Address & Contacts",
        "Attendance & Leaves",
        "Salary",
        "Personal",
    }

    meta = frappe.get_meta("Employee")
    fields_in_tabs = []
    current_tab = None

    for f in meta.fields:
        if f.fieldtype == "Tab Break":
            current_tab = f.label
        if (
            f.fieldtype
            not in (
                "Section Break",
                "Column Break",
                "Tab Break",
                "HTML",
                "Table",
                "Button",
                "Image",
                "Fold",
            )
            and f.fieldname
            and current_tab in INCLUDED_TABS
        ):
            fields_in_tabs.append(f.fieldname)

    total = len(fields_in_tabs)
    filled = 0
    for field in fields_in_tabs:
        value = getattr(doc, field, None)
        if value not in (None, "", [], {}) and not (
            isinstance(value, str) and value.strip() == ""
        ):
            filled += 1

    percent = round((filled / total) * 100) if total else 0
    doc.custom_fields_filled_percent = percent
    return percent, total, filled


@frappe.whitelist()
def set_reports_to_user(doc, method=None):
    # Don't share on first save (doc is new)
    is_new = getattr(doc, "_is_new", False)

    if not getattr(doc, "reports_to_user", None):
        owner = getattr(doc, "owner", None)
        if not owner:
            frappe.throw("لا يمكن حفظ المستند لأن الحقل 'المالك' غير محدد.")

        emp = frappe.get_value("Employee", {"user_id": owner}, ["name", "reports_to"])
        if not emp:
            frappe.throw(f"لا يمكن العثور على موظف مرتبط بالمستخدم '{owner}'.")
        if not emp[1]:
            frappe.throw(f"يجب تحديد المدير للموظف '{emp[0]}'.")

        reports_to_user_id = frappe.get_value("Employee", emp[1], "user_id")
        if not reports_to_user_id:
            frappe.throw(f"الموظف المدير '{emp[1]}' ليس لديه مستخدم مرتبط.")

        doc.reports_to_user = reports_to_user_id


def share_lead_with_reports_to_user(doc, method=None):
    if getattr(doc, "reports_to_user", None):
        try:
            share_document_with_user(doc, doc.reports_to_user)
        except Exception as e:
            pass


def share_document_with_user(doc, user):
    try:
        # Check if DocType is submittable
        is_submittable = frappe.get_cached_value(
            "DocType", doc.doctype, "is_submittable"
        )

        frappe.share.add(
            doctype=doc.doctype,
            name=doc.name,
            user=user,
            read=1,
            write=1,
            submit=1 if is_submittable else 0,
        )

    except Exception as e:
        pass


@frappe.whitelist()
def upload_serials_from_file(file_url, docname, row_idx, doctype):
    """
    Reads an uploaded CSV/XLSX file, extracts the 'serial' column,
    and returns the serials as a \n-separated string for the correct child row.
    """
    if not file_url:
        frappe.throw("File URL is required.")

    # Step 1: Resolve file path
    rel_path = file_url.lstrip("/")
    abs_path = os.path.join(frappe.get_site_path(), rel_path)
    if not os.path.isfile(abs_path):
        frappe.throw(f"File not found at resolved path: {abs_path}")

    # Step 2: Read file as Excel or CSV (by extension, fallback by content)
    ext = abs_path.split(".")[-1].lower()
    filecontent = None
    with open(abs_path, "rb") as f:
        filecontent = f.read()
    df = None

    if ext in ("xlsx", "xls"):
        try:
            df = pd.read_excel(io.BytesIO(filecontent))
        except Exception as e:
            frappe.throw(f"Unable to read Excel file: {e}")
    elif ext == "csv":
        try:
            df = pd.read_csv(io.BytesIO(filecontent))
        except Exception as e:
            frappe.throw(f"Unable to read CSV file: {e}")
    else:
        # Try reading as Excel, then as CSV
        try:
            df = pd.read_excel(io.BytesIO(filecontent))
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(filecontent))
            except Exception:
                frappe.throw("File must be an Excel (.xlsx) or CSV (.csv) file.")

    # Step 3: Ensure 'serial' column exists
    if "serial" not in (c.lower() for c in df.columns):
        frappe.throw(
            'No column named "serial" found in the uploaded file. (Case-insensitive match expected)'
        )
    # Find the actual column name for robust case-insensitivity
    serial_col = next(col for col in df.columns if col.lower() == "serial")
    serials = df[serial_col].dropna().astype(str).map(str.strip).tolist()
    serials = [s for s in serials if s]

    # Step 4: Get the qty from the correct child row
    doc = frappe.get_doc(doctype, docname)
    items = doc.items
    # row_idx is typically 1-based in ERPNext grid, so subtract 1 for Python list index
    row_number = int(row_idx) - 1
    if row_number < 0 or row_number >= len(items):
        frappe.throw(f"Row index {row_idx} is invalid for items table.")
    item_row = items[row_number]

    qty = float(item_row.qty)
    serials_count = len(serials)

    # Step 5: Validate qty vs serials count
    if int(qty) != serials_count:
        frappe.throw(
            f"Serials count ({serials_count}) does not match row quantity ({int(qty)}). "
            "Please upload the correct number of serial numbers."
        )

    # Step 6: Return serials string
    serials_str = "\n".join(serials)
    return {"serials": serials_str}


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def serial_and_batch_bundle_query(
    doctype, txt, searchfield, start, page_len, filters, as_dict=False
):
    doctype = "Serial and Batch Bundle"
    searchfields = frappe.get_meta(doctype).get_search_fields()
    searchfields = " or ".join(
        "sbb." + field + " like %(txt)s" for field in searchfields
    )

    return frappe.db.sql(
        """select sbb.name, sbb.item_code, sbb.item_name
        from `tabSerial and Batch Bundle` sbb
        join `tabStock Entry Detail` sed on sed.name = sbb.voucher_detail_no  
        where sbb.docstatus = 1
          and sbb.voucher_type = "Stock Entry"
          and sed.custom_installation_order = %(installation_order)s
          and sbb.type_of_transaction = "Inward"
            and ({key} like %(txt)s
                or sbb.item_name like %(txt)s
                or sbb.item_code like %(txt)s
                or {scond})
        order by
            (case when locate(%(_txt)s, sbb.name) > 0 then locate(%(_txt)s, sbb.name) else 99999 end),
            (case when locate(%(_txt)s, sbb.item_name) > 0 then locate(%(_txt)s, sbb.item_name) else 99999 end),
            (case when locate(%(_txt)s, sbb.item_code) > 0 then locate(%(_txt)s, sbb.item_code) else 99999 end),
            sbb.idx desc,
            sbb.name, sbb.item_name
        limit %(page_len)s offset %(start)s""".format(
            **{
                "key": "sbb." + searchfield,
                "scond": searchfields,
            }
        ),
        {
            "txt": "%%%s%%" % txt,
            "_txt": txt.replace("%", ""),
            "start": start,
            "page_len": page_len,
            "installation_order": filters.get("custom_installation_order"),
        },
    )


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def serial_no_query(doctype, txt, searchfield, start, page_len, filters, as_dict=False):
    doctype = "Serial No"
    searchfields = frappe.get_meta(doctype).get_search_fields()
    searchfields = " or ".join(field + " like %(txt)s" for field in searchfields)
    warehouse = frappe.db.get_all(
        "Installation Order Technician",
        filters={
            "parent": filters.get("custom_installation_order"),
        },
        pluck="warehouse",
    )
    warehouse.append(filters.get("warehouse"))
    warehouse.append(
        frappe.db.get_value(
            "Installation Order",
            filters.get("custom_installation_order"),
            "warehouse",
        )
    )
    warehouse = list(set(warehouse))
    return frappe.db.sql(
        """select name, item_code, item_name
        from `tabSerial No`
        where status = "Active"
        and warehouse in %(warehouse)s
        and custom_device_setup is null
            and ({key} like %(txt)s
                or item_name like %(txt)s
                or item_code like %(txt)s
                or {scond})
        order by
            (case when locate(%(_txt)s, name) > 0 then locate(%(_txt)s, name) else 99999 end),
            (case when locate(%(_txt)s, item_name) > 0 then locate(%(_txt)s, item_name) else 99999 end),
            (case when locate(%(_txt)s, item_code) > 0 then locate(%(_txt)s, item_code) else 99999 end),
            idx desc,
            name, item_name
        limit %(page_len)s offset %(start)s""".format(
            **{
                "key": searchfield,
                "scond": searchfields,
            }
        ),
        {
            "txt": "%%%s%%" % txt,
            "_txt": txt.replace("%", ""),
            "start": start,
            "page_len": page_len,
            "warehouse": tuple(warehouse),
        },
    )


from tst.tst.doctype.site.site import Site
from typing import cast

import requests


@frappe.whitelist()
def check_user(customerID: str) -> frappe._dict[str, str]:
    available_sites = frappe.db.get_all("Site", {"status": "Active"}, pluck="name")
    if not available_sites:
        frappe.throw(_("No active sites found."))

    if not customerID or not isinstance(customerID, str):
        frappe.throw(_("Invalid Customer ID provided."))
    if not customerID.isalnum():
        frappe.throw(_("Customer ID must be alphanumeric."))

    response = frappe._dict(
        {
            "user_server": [],
            "message": "",
            "status": "success",
            "error": None,
        }
    )
    for site in available_sites:
        site_doc: Site = cast(Site, frappe.get_cached_doc("Site", site))

        params = {
            "CustomerID": customerID,
            "ServerIP": site_doc.server,
        }
        headers = {
            "APIKey": site_doc.api_key,
        }

        request = requests.get(
            f"http://{site_doc.server}/ERPAPIs/API.asmx/CheckUser",
            params=params,
            headers=headers,
        )
        request_response = request.json()
        if request.status_code != 200:
            frappe.throw(
                _(
                    "Failed to connect to the server at {server}. "
                    "Please check the server IP and try again."
                ).format(server=site_doc.server)
            )

        if request_response.get("status") == "1":
            response.user_server.append(
                {
                    "server": site_doc.server,
                    "UserID": request_response["data"].get("UserID"),
                    "UserName": request_response["data"].get("UserName"),
                    "LoginName": request_response["data"].get("LoginName"),
                    "Password": request_response["data"].get("Password"),
                    "CustomerID": request_response["data"].get("CustomerID"),
                }
            )
        elif request_response.get("status") == "0":
            response.status = "error"
            response.error = request_response.get("message")
            frappe.throw(
                _("Error from server {server}: {error_message}").format(
                    server=site_doc.server,
                    error_message=response.error or "Unknown error",
                )
            )
    return response


@frappe.whitelist()
def create_user(
    DeviceSetupId: str,
    Username: str,
    UserLogin: str,
    Password: str,
    CustomerID: str,
    UserType: str,
    ServerIP: str,
) -> frappe._dict[str, str]:
    if (
        not Username
        or not UserLogin
        or not Password
        or not CustomerID
        or not UserType
        or not ServerIP
    ):
        frappe.throw(_("All parameters are required."))

    site_doc: Site = cast(Site, frappe.get_cached_doc("Site", {"server": ServerIP}))

    params = {
        "Username": Username,
        "UserLogin": UserLogin,
        "Password": Password,
        "CustomerID": CustomerID,
        "UserType": UserType,
        "ServerIP": ServerIP,
    }

    headers = {
        "APIKey": site_doc.api_key,
    }

    request = requests.get(
        f"http://{site_doc.server}/ERPAPIs/API.asmx/CreateUser",
        params=params,
        headers=headers,
    )
    request_response = request.json()

    if request.status_code != 200:
        frappe.throw(
            _(
                "Failed to connect to the server at {server}. "
                "Please check the server IP and try again."
                "Server response: {error_message}"
            ).format(
                server=site_doc.server,
                error_message=request_response.get("message", "Unknown error"),
            )
        )

    if request_response.get("status") == "1":
        device_setup_doc: DeviceSetup = cast(
            DeviceSetup, frappe.get_doc("Device Setup", DeviceSetupId)
        )
        device_setup_doc.response = str(request_response)
        device_setup_doc.username = Username
        device_setup_doc.userlogin = UserLogin
        device_setup_doc.password = Password
        device_setup_doc.user_id = str(
            request_response["data"].get("userid")
            if request_response["data"].get("userid")[0]
            else ""
        )
        device_setup_doc.customer_id = CustomerID
        device_setup_doc.user_type = UserType
        device_setup_doc.site = site_doc.name
        device_setup_doc.save()
        return frappe._dict(
            {
                "message": _("User created successfully."),
                "userID": request_response["data"].get("userid"),
            }
        )
    else:
        return frappe._dict(
            {
                "status": "error",
                "message": request_response.get("message", "Unknown error"),
            }
        )


@frappe.whitelist()
def add_device(
    DeviceSetupId: str,
    CustomerID: str,
    UserID: str,
    UserName: str,
    UserType: str,
    LoginNAME: str,
    Password: str,
    ServerIP: str,
) -> frappe._dict[str, str]:
    if not all(
        [
            DeviceSetupId,
            CustomerID,
            UserID,
            UserName,
            UserType,
            LoginNAME,
            Password,
            ServerIP,
        ]
    ):
        frappe.throw(_("All parameters are required."))

    site_doc: Site = cast(Site, frappe.get_cached_doc("Site", {"server": ServerIP}))
    device_setup: DeviceSetup = cast(
        DeviceSetup, frappe.get_doc("Device Setup", DeviceSetupId)
    )
    """
    
        "UserName": UserName,
        "UserType": UserType,
        "LoginNAME": LoginNAME,
        "Password": Password,
    """
    device_setup.username = UserName
    device_setup.userlogin = LoginNAME
    device_setup.password = Password
    device_setup.user_id = UserID
    device_setup.customer_id = CustomerID
    device_setup.user_type = UserType
    device_setup.site = site_doc.name

    params = {
        "CustomerID": str(CustomerID),
        "UserID": str(UserID),
        "SerialNumber": str(device_setup.serial_no),
        "VehicleName": str(device_setup.vehicle_name),
        "VehicleType": str(device_setup.vehicle_type),
        "ICCID": str(device_setup.iccid),
        "DeviceType": str(device_setup.device_type),
        "CreateDate": str(device_setup.create_date),
        "Odometer": str(device_setup.odometer),
        "ServerIP": str(ServerIP),
    }

    headers = {
        "APIKey": site_doc.api_key,
    }

    request = requests.get(
        f"http://{site_doc.server}/ERPAPIs/API.asmx/AddDevice",
        params=params,
        headers=headers,
    )
    try:
        request_response = request.json()
    except ValueError:
        # Not a valid JSON
        frappe.log_error(
            f"Non-JSON response from {site_doc.server}: {request.text}",
            "Invalid JSON Response",
        )
        return frappe._dict(
            {
                "status": "error",
                "message": f"Server returned invalid JSON: {request.text}",
            }
        )
    if request.status_code != 200:
        frappe.throw(
            _(
                "Failed to connect to the server at {server}. "
                "Please check the server IP and try again."
            ).format(server=site_doc.server)
        )

    if request_response.get("status") == "1":
        device_setup.response = str(request_response)
        device_setup.status = "Active"
        device_setup.save()
        device_setup.submit()
        return frappe._dict(
            {
                "message": _("Device successfully added to user."),
                "status": "success",
            }
        )
    else:
        frappe.throw(
            _("Error from server {server}: {error_message}").format(
                server=site_doc.server,
                error_message=request_response,
            )
        )
