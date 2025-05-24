import frappe
from frappe import _

def validate(doc, method=None):
    is_valid_number(doc.mobile_no)
    validate_no_of_cars(doc)
    check_duplicate_tax_or_national_id(doc)
    check_duplicate_mobile_or_email(doc)

def is_valid_number(Number):
    """
    Validates that the provided mobile number consists only of digits
    and is exactly 10 characters long. Raises an error if validation fails.
    """
    if Number:
        if not Number.isdigit():
            frappe.throw(_("Mobile number must contain digits only (0-9)."))
        elif len(Number) != 10:
            frappe.throw(_("Mobile number must be exactly 10 digits."))

def validate_no_of_cars(doc):
    """
    Validates that the total quantity of cars listed in custom_car_details
    matches the custom_number_of_cars field. If custom_number_of_cars is not set,
    it will be automatically updated with the total quantity from the car details.
    """
    total_no_of_cars = 0.0
    if doc.custom_car_details:
        for row in doc.custom_car_details:
            total_no_of_cars += row.qty

    if doc.custom_number_of_cars:
        if total_no_of_cars != doc.custom_number_of_cars:
            frappe.throw(_(
                f"Total quantity of cars ({total_no_of_cars}) "
                f"does not match the declared number of cars ({doc.custom_number_of_cars}). "
                "Please make sure these values are consistent."
            ))
    elif doc.custom_car_details and not doc.custom_number_of_cars:
        doc.custom_number_of_cars = total_no_of_cars

def check_duplicate_tax_or_national_id(doc):
    """
    Checks if there is an existing Lead with the same Tax ID (for Company)
    or National ID (for Individual), excluding the current doc.
    If found, shows a message indicating which user created the existing Lead to prevent duplicates.
    """
    if doc.type == "Company" and doc.custom_tax_id:
        existing = frappe.db.get_value(
            "Lead",
            {
                "custom_tax_id": doc.custom_tax_id,
                "name": ["!=", doc.name]
            },
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                f"A Lead ({lead_name}) already exists with the same Tax ID, created by user: {owner}."
                " Please verify to avoid duplicate entries."
            ))
    elif doc.type == "Individual" and doc.custom_national_id:
        existing = frappe.db.get_value(
            "Lead",
            {
                "custom_national_id": doc.custom_national_id,
                "name": ["!=", doc.name]
            },
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                f"A Lead ({lead_name}) already exists with the same National ID, created by user: {owner}."
                " Please verify to avoid duplicate entries."
            ))

def check_duplicate_mobile_or_email(doc):
    """
    Checks if another Lead exists with the same mobile number or email id (excluding current doc).
    If found, throws an error with existing lead name and creator.
    """
    if doc.mobile_no:
        existing = frappe.db.get_value(
            "Lead",
            {
                "mobile_no": doc.mobile_no,
                "name": ["!=", doc.name]
            },
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                f"Mobile Number already exists in Lead: {lead_name} (Created by: {owner})"
            ))

    if doc.email_id:
        existing = frappe.db.get_value(
            "Lead",
            {
                "email_id": doc.email_id,
                "name": ["!=", doc.name]
            },
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                f"Email ID already exists in Lead: {lead_name} (Created by: {owner})"
            ))