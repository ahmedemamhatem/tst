import frappe
from frappe import _
from geopy.geocoders import Nominatim
from erpnext.crm.doctype.lead.lead import Lead as ErpnextLead


class CustomLead(ErpnextLead):
    def check_email_id_is_unique(self):
        """Override the check_email_id_is_unique method to check for duplicate email IDs."""
        if self.email_id:
            # Fetch an existing lead with the same email ID
            existing_lead = frappe.db.get_value(
                'Lead',
                {'email_id': self.email_id, 'name': ['!=', self.name]},
                ['name', 'owner'],  # Fetch both the lead name and its owner/creator
                as_dict=True
            )
            
            if existing_lead:
                # If a duplicate is found, fetch the creator's name
                creator = frappe.db.get_value('User', existing_lead.owner, 'full_name')

                # Throw a translatable error message with the lead name and creator's name
                frappe.throw(
                    _("A Lead with this email ID already exists: {0} (Created by: {1})").format(
                        existing_lead.name, creator
                    )
                )
            else:
                # Optionally display a success message if no duplicate is found
                frappe.msgprint(_("Email ID is unique!"))


def set_custom_address(doc, method=None):
    """Set the custom address fields based on latitude and longitude."""
    if doc.custom_longitude and doc.custom_latitude:
        try:
            # Initialize geolocator with user agent
            geolocator = Nominatim(user_agent="frappe_map")

            # Reverse geocode to get location details in Arabic
            location = geolocator.reverse(f"{doc.custom_latitude}, {doc.custom_longitude}", language='ar')
            addr = getattr(location, "raw", {}).get('address', {}) if location else {}

            # Extract address components in Arabic
            road = addr.get('road') or ""
            city = addr.get('city') or addr.get('state') or ""
            state = addr.get('state') or ""
            country = addr.get('country') or ""
            postcode = addr.get('postcode') or ""
            neighborhood = addr.get('neighbourhood') or ""
            suburb = addr.get('suburb') or ""
            municipality = addr.get('municipality') or ""

            # Save detailed fields to the document
            doc.custom_location_city = doc.custom_location_city or city
            doc.custom_location_state = doc.custom_location_state or state
            doc.custom_postal_code = doc.custom_postal_code or postcode
            doc.custom_location_suburb = doc.custom_location_suburb or suburb
            doc.custom_location_country = doc.custom_location_country or country
            doc.custom_location_municipality = doc.custom_location_municipality or municipality
            doc.custom_address_line = doc.custom_address_line or (location.address if location else "")

            # Format a compact, prioritized address string
            address_parts = [road, neighborhood, suburb, city, state, postcode, country]
            formatted = ', '.join([p for p in address_parts if p])
            doc.custom_address = doc.custom_address or formatted[:140]  # Truncate if needed

        except Exception as e:
            # Log error and notify the user
            frappe.log_error(message=f"Failed to fetch Arabic address: {str(e)}", title="Geolocation Error")
            frappe.throw(_("Unable to fetch Arabic address. Please check the logs for more details."))


def validate(doc, method=None):
    """Validate the Lead document."""
    if not doc.custom_creation_time and doc.creation:
        doc.custom_creation_time = doc.creation
    is_valid_number(doc.mobile_no)
    validate_no_of_cars(doc)
    check_duplicate_tax_or_national_id(doc)
    check_duplicate_mobile_or_email(doc)
    set_custom_address(doc)


def is_valid_number(number):
    """
    Validate that the provided mobile number consists only of digits
    and is exactly 10 characters long.
    """
    if number:
        if not number.isdigit():
            frappe.throw(_("Mobile number must contain digits only (0-9)."))
        elif len(number) != 10:
            frappe.throw(_("Mobile number must be exactly 10 digits."))


def validate_no_of_cars(doc):
    """
    Validate that the total quantity of cars matches the custom_number_of_cars field.
    """
    total_no_of_cars = 0.0
    if doc.custom_car_details:
        for row in doc.custom_car_details:
            total_no_of_cars += row.qty

    if doc.custom_number_of_cars:
        if total_no_of_cars != doc.custom_number_of_cars:
            frappe.throw(_(
                "Total quantity of cars ({0}) does not match the declared number of cars ({1}). "
                "Please make sure these values are consistent."
            ).format(total_no_of_cars, doc.custom_number_of_cars))
    elif doc.custom_car_details and not doc.custom_number_of_cars:
        doc.custom_number_of_cars = total_no_of_cars


def check_duplicate_tax_or_national_id(doc):
    """
    Check for duplicate Tax ID or National ID, depending on the Lead type.
    """
    if doc.type == "Company" and doc.custom_tax_id:
        existing = frappe.db.get_value(
            "Lead",
            {"custom_tax_id": doc.custom_tax_id, "name": ["!=", doc.name]},
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                "A Lead ({0}) already exists with the same Tax ID, created by user: {1}."
            ).format(lead_name, owner))
    elif doc.type == "Individual" and doc.custom_national_id:
        existing = frappe.db.get_value(
            "Lead",
            {"custom_national_id": doc.custom_national_id, "name": ["!=", doc.name]},
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                "A Lead ({0}) already exists with the same National ID, created by user: {1}."
            ).format(lead_name, owner))


def check_duplicate_mobile_or_email(doc):
    """
    Check for duplicate mobile numbers or email IDs.
    """
    if doc.mobile_no:
        existing = frappe.db.get_value(
            "Lead",
            {"mobile_no": doc.mobile_no, "name": ["!=", doc.name]},
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                "Mobile number already exists in Lead: {0} (Created by: {1})"
            ).format(lead_name, owner))

    if doc.email_id:
        existing = frappe.db.get_value(
            "Lead",
            {"email_id": doc.email_id, "name": ["!=", doc.name]},
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            frappe.throw(_(
                "Email ID already exists in Lead: {0} (Created by: {1})"
            ).format(lead_name, owner))