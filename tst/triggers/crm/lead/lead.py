import frappe
from frappe import _
from geopy.geocoders import Nominatim


def set_custom_address(doc, method=None):
    if doc.custom_longitude and doc.custom_latitude:
        try:
            # Initialize geolocator with user agent
            geolocator = Nominatim(user_agent="frappe_map")

            # Reverse geocode to get location details in Arabic
            location = geolocator.reverse(
                f"{doc.custom_latitude}, {doc.custom_longitude}", language="ar"
            )
            addr = getattr(location, "raw", {}).get("address", {}) if location else {}

            # Extract address components in Arabic
            road = addr.get("road") or ""  # Default: Unknown in Arabic
            city = (
                addr.get("city") or addr.get("state") or ""  # Default: Unknown
            )
            state = addr.get("state") or ""
            country = addr.get("country") or ""
            postcode = addr.get("postcode") or ""
            neighborhood = addr.get("neighbourhood") or ""
            suburb = addr.get("suburb") or ""
            county = addr.get("county") or ""
            municipality = addr.get("municipality") or ""

            # Save detailed fields to the document
            doc.custom_location_city = doc.custom_location_city or city
            doc.custom_location_state = doc.custom_location_state or state
            doc.custom_postal_code = doc.custom_postal_code or postcode
            doc.custom_location_state = doc.custom_location_state or road
            doc.custom_postal_code = doc.custom_postal_code or neighborhood
            doc.custom_location_suburb = doc.custom_location_suburb or suburb
            doc.custom_location_country = doc.custom_location_country or country
            doc.custom_location_municipality = (
                doc.custom_location_municipality or municipality
            )
            doc.custom_address_line = doc.custom_address_line or (
                location.address if location else ""
            )

            # Format a compact, prioritized address string (Arabic)
            address_parts = [road, neighborhood, suburb, city, state, postcode, country]
            formatted = ", ".join([p for p in address_parts if p])
            doc.custom_address = (
                doc.custom_address or formatted[:140]
            )  # Truncate if needed

        except Exception as e:
            # Log error and notify the user
            frappe.log_error(
                message=f"Failed to fetch Arabic address: {str(e)}",
                title="Geolocation Error",
            )
            frappe.throw(
                _(
                    "Unable to fetch Arabic address. Please check the logs for more details."
                )
            )


def validate(doc, method=None):
    is_valid_number(doc.mobile_no)
    validate_no_of_cars(doc)
    check_duplicate_tax_or_national_id(doc)
    check_duplicate_mobile_or_email(doc)
    set_custom_address(doc)


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
            frappe.throw(
                _(
                    f"Total quantity of cars ({total_no_of_cars}) "
                    f"does not match the declared number of cars ({doc.custom_number_of_cars}). "
                    "Please make sure these values are consistent."
                )
            )
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
            {"custom_tax_id": doc.custom_tax_id, "name": ["!=", doc.name]},
            ["name", "owner"],
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(
                _(
                    f"A Lead ({lead_name}) already exists with the same Tax ID, created by user: {owner}."
                    " Please verify to avoid duplicate entries."
                )
            )
    elif doc.type == "Individual" and doc.custom_national_id:
        existing = frappe.db.get_value(
            "Lead",
            {"custom_national_id": doc.custom_national_id, "name": ["!=", doc.name]},
            ["name", "owner"],
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(
                _(
                    f"A Lead ({lead_name}) already exists with the same National ID, created by user: {owner}."
                    " Please verify to avoid duplicate entries."
                )
            )


def check_duplicate_mobile_or_email(doc):
    """
    Checks if another Lead exists with the same mobile number or email id (excluding current doc).
    If found, throws an error with existing lead name and creator.
    """
    if doc.mobile_no:
        existing = frappe.db.get_value(
            "Lead",
            {"mobile_no": doc.mobile_no, "name": ["!=", doc.name]},
            ["name", "owner"],
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(
                _(
                    f"Mobile Number already exists in Lead: {lead_name} (Created by: {owner})"
                )
            )

    if doc.email_id:
        existing = frappe.db.get_value(
            "Lead",
            {"email_id": doc.email_id, "name": ["!=", doc.name]},
            ["name", "owner"],
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(
                _(f"Email ID already exists in Lead: {lead_name} (Created by: {owner})")
            )
