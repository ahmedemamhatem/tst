import frappe
from frappe.utils import nowdate

@frappe.whitelist()
def after_insert(doc,method= None):
    if not doc.custom_is_sub_technician:
        check_required_items(doc)

def check_required_items(doc):
    material_requests = {}

    installation_order_items, technician_warehouse, assistant_technicians = get_items_from_installation_order(doc.custom_installation_order)

    if installation_order_items:
        for item in installation_order_items:
            item_code = item.get("item_code")
            required_qty = item.get("qty")

            # Step 1: Stock in technician warehouse
            tech_qty = get_stock_qty(item_code, technician_warehouse)

            # Step 2: Stock in all assistant  technician warehouses
            assistant_total_qty = 0
            for tech in assistant_technicians:
                assistant_wh = tech.get("warehouse")
                if assistant_wh:
                    assistant_total_qty += get_stock_qty(item_code, assistant_wh)

            # Step 3: Is total stock enough?
            total_available = tech_qty + assistant_total_qty
            if total_available >= required_qty:
                continue  # No material request needed

            # Step 4: Not enough stock anywhere → create material request
            missing_qty = required_qty - total_available
            default_warehouse = get_default_warehouse(item_code)

            material_requests.setdefault(default_warehouse, []).append({
                'item_code': item_code,
                'qty': missing_qty,
                'schedule_date': nowdate(),
                'from_warehouse': default_warehouse,
                'warehouse': technician_warehouse  
            })

    if material_requests:
        for source_warehouse, items in material_requests.items():
            create_material_request(items, technician_warehouse,source_warehouse,doc.custom_technician,doc.name)

            
def get_items_from_installation_order(installation_order):
    """
    fetches all items from its Installation Order , 
    """
    
    installation_order = frappe.get_cached_doc("Installation Order", installation_order)

    return installation_order.get("items") or [] , installation_order.warehouse , installation_order.get("sub_installation_order_technician") or []

def get_default_warehouse(item_code):
    default_warehouse = frappe.get_cached_value("Item Default",{"parent":item_code},"default_warehouse")
    
    return default_warehouse

def get_stock_qty(item_code, warehouse):
    """
    Returns the actual quantity of an item in a specific warehouse.

    :param item_code: Item code to check
    :param warehouse: Warehouse to check in
    :return: Actual quantity available (float)
    """
    return frappe.db.get_value('Bin', {
        'item_code': item_code,
        'warehouse': warehouse
    }, 'actual_qty') or 0


def create_material_request(items , target_warehouse ,source_warehouse,technician,reference_link):
    
    mr = frappe.get_doc({
        'doctype': 'Material Request',
        'material_request_type': 'Material Transfer',
        "custom_reference_doctype":"Appointment",
        "custom_reference_link":reference_link,
        'schedule_date': nowdate(),
        "set_from_warehouse":source_warehouse,
        'set_warehouse': target_warehouse,
        'items': items
    })

    mr.insert()
    if mr.name:
        warehouse_manager_user = frappe.get_cached_value("Warehouse", {"name": target_warehouse}, "custom_warehouse_manager")
        mobile_no = None

        if warehouse_manager_user:
            mobile_no = frappe.get_cached_value("User", {"name": warehouse_manager_user}, "mobile_no")

        recipient_persons = [
            {
                "receipent_person": "Technician",
                "mobile_no": frappe.get_cached_value("Technician", {"name": technician}, "whatsapp_number")
            },
            {
                "receipent_person": "Warehouse Manager",
                "mobile_no": mobile_no
            },
        ]

        create_whatsapp_message_for_material_request(mr.name,warehouse_manager_user, recipient_persons)

        return mr.name


def create_whatsapp_message_for_material_request(material_request_name,warehouse_manager_user, recipients):
    """
    Create WhatsApp Message for each recipient (technician, warehouse manager).
    
    :param material_request_name: Name of the Material Request
    :param recipients: List of dicts with keys: receipent_person, mobile_no
    """
    material_request = frappe.get_cached_doc("Material Request", material_request_name)

    # Extract shared data
    order_number = material_request.name
    posting_date = material_request.transaction_date
    owner = warehouse_manager_user
    owner_contact = frappe.get_cached_value("User", owner, "mobile_no") or "Not Provided"
    warehouse = material_request.set_warehouse or "Not Specified"

    # Format items
    item_lines = []
    for item in material_request.items:
        line = f"{item.qty} - {item.item_name} - {item.description or ''}"
        item_lines.append(line)
    items_text = "\n".join(item_lines)

    for recipient in recipients:
        mobile_no = recipient.get("mobile_no")
        role = recipient.get("receipent_person")

        if not mobile_no:
            frappe.log_error(f"No mobile number for {role}", "WhatsApp Message Creation")
            continue

        # Compose message
        message = f"""
                تم تجهيز الطلبية

                رقم الطلبية: {order_number}

                تاريخ الإنشاء: {posting_date}

                موقع التسليم: {warehouse}

                المسئول عن التسليم: {owner}

                هاتف للتواصل: {owner_contact}

                تفاصيل الطلبية:
                {items_text}

                حالة الطلبية: Draft
                """

        # Create WhatsApp Message
        whatsapp_doc = frappe.new_doc("WhatsApp Message")
        whatsapp_doc.mobile_no = mobile_no
        whatsapp_doc.message = message
        whatsapp_doc.insert(ignore_permissions=True)

    frappe.db.commit()

@frappe.whitelist()
def validate(doc, method=None):
    set_custom_appointment_status(doc)


def set_custom_appointment_status(doc):
    mr = frappe.db.exists("Material Request", {"custom_reference_doctype": "Appointment", 
                                               "custom_reference_link": doc.name})
    if mr:
        mr_doc = frappe.get_cached_doc("Material Request", mr)
        if mr_doc.status != "Transferred":
            doc.custom_appointment_status = "Out of Stock"

@frappe.whitelist()
def on_submit(doc, method=None):
    pass