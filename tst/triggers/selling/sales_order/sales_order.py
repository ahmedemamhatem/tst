import frappe
from frappe.model.mapper import get_mapped_doc

@frappe.whitelist()
def before_validate(doc,method = None):
    set_contract_type(doc)

@frappe.whitelist()
def make_installation_order(source_name, target_doc=None):
    args = frappe.form_dict.get("args")
    if isinstance(args, str):
        args = frappe.parse_json(args)

    address = args.get("address")
    parent_address = args.get("parent_address")

    if not address:
        frappe.throw("Delivery address is required to create the Installation Order.")

    def item_filter(doc):
        return True if parent_address else doc.custom_address == address

    def postprocess(source_doc, target_doc):
        target_doc.customer_address = address

    doc = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Installation Order",
                "field_map": {
                    "customer": "customer",
                    "name": "sales_order",
                    "delivery_date": "installation_date",
                }
            },
            "Sales Order Item": {
                "doctype": "Installation Order Item",
                "field_map": {
                    "custom_contact": "contact"
                },
                "condition": item_filter
            }
        },
        target_doc,
        postprocess=postprocess
    )

    return doc



def set_contract_type(doc):
    contract_type_row = frappe.get_all(
        "Contract Type Settings",
        filters={"min_qty": ["<", doc.total_qty]},
        fields=["contract_type"],
        order_by="min_qty desc",
        limit=1
    )

    contract_type = contract_type_row[0].contract_type if contract_type_row else None
    
    doc.custom_contract_type = contract_type


@frappe.whitelist()
def get_customer_address_and_contacts_list(customer):
    if not customer:
        return []

    addresses = frappe.get_all(
        "Dynamic Link",
        filters={
            "link_doctype": "Customer",
            "link_name": customer,
            "parenttype": "Address"
        },
        pluck="parent"
    )

    contacts = frappe.get_all(
        "Dynamic Link",
        filters={
            "link_doctype": "Customer",
            "link_name": customer,
            "parenttype":"Contact"
        },
        pluck="parent"
    )
    
    return addresses,contacts

