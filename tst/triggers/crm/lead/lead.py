import frappe
from frappe import _
from geopy.geocoders import Nominatim
from erpnext.crm.doctype.lead.lead import Lead as ErpnextLead


class CustomLead(ErpnextLead):
    def check_email_id_is_unique(self):
        """Override the check_email_id_is_unique method to check for duplicate email IDs."""
        # Fetch the current user's language
        user_lang = frappe.db.get_value("User", frappe.session.user, "language")

        if self.email_id:
            # Fetch an existing lead with the same email ID
            existing_lead = frappe.db.get_value(
                'Lead',
                {'email_id': self.email_id, 'name': ['!=', self.name]},
                ['name', 'owner'],  # Fetch both the lead name and its owner/creator
                as_dict=True
            )

            if existing_lead:
                # Check if the owner of the existing lead is the same as the current lead's owner
                if existing_lead.owner == frappe.session.user:
                    # If the owner is the same, no issue, continue
                    pass
                else:
                    # If the owner is different, fetch the creator's name
                    creator = frappe.db.get_value('User', existing_lead.owner, 'full_name')

                    # Throw a translatable error message with the lead name and creator's name
                    if user_lang == "ar":
                        frappe.throw(
                            "يوجد عميل بنفس البريد الإلكتروني: {0} (تم إنشاؤه بواسطة: {1})".format(
                                existing_lead.name, creator
                            ),
                            title="تكرار في البريد الإلكتروني"
                        )
                    else:
                        frappe.throw(
                            "A Lead with this email ID already exists: {0} (Created by: {1})".format(
                                existing_lead.name, creator
                            ),
                            title="Duplicate Email ID"
                        )
            else:
                # Optionally display a success message if no duplicate is found
                if user_lang == "ar":
                    frappe.msgprint("البريد الإلكتروني فريد!")
                else:
                    frappe.msgprint("Email ID is unique!")

def set_custom_address(doc, method=None):
    """Set the custom address fields based on latitude and longitude."""
    # Fetch the current user's language
    user_lang = frappe.db.get_value("User", frappe.session.user, "language")

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
            if user_lang == "ar":
                frappe.throw("تعذر استرجاع العنوان بالعربية. يرجى التحقق من السجلات لمزيد من التفاصيل.")
            else:
                frappe.throw("Unable to fetch Arabic address. Please check the logs for more details.")


def validate(doc, method=None):
    """Validate the Lead document."""
    # Fetch the current user's language
    user_lang = frappe.db.get_value("User", frappe.session.user, "language")

    if not doc.custom_creation_time and doc.creation:
        doc.custom_creation_time = doc.creation

    is_valid_number(doc.mobile_no, user_lang)
    validate_no_of_cars(doc, user_lang)
    check_duplicate_tax_or_national_id(doc, user_lang)
    check_duplicate_mobile_or_email(doc, user_lang)
    set_custom_address(doc)


def is_valid_number(number, user_lang):
    """
    Validate that the provided mobile number consists only of digits
    and is exactly 10 characters long.
    """
    if number:
        if not number.isdigit():
            if user_lang == "ar":
                frappe.throw("يجب أن يحتوي رقم الهاتف على أرقام فقط (0-9).")
            else:
                frappe.throw("Mobile number must contain digits only (0-9).")
        elif len(number) != 10:
            if user_lang == "ar":
                frappe.throw("يجب أن يتكون رقم الهاتف من 10 أرقام بالضبط.")
            else:
                frappe.throw("Mobile number must be exactly 10 digits.")


def validate_no_of_cars(doc, user_lang):
    """
    Validate that the total quantity of cars matches the custom_number_of_cars field.
    """
    total_no_of_cars = 0.0
    if doc.custom_car_details:
        for row in doc.custom_car_details:
            total_no_of_cars += row.qty

    if doc.custom_number_of_cars:
        if total_no_of_cars != doc.custom_number_of_cars:
            if user_lang == "ar":
                frappe.throw(
                    "إجمالي عدد السيارات ({0}) لا يطابق العدد المُعلن للسيارات ({1}). يرجى التأكد من تناسق هذه القيم.".format(
                        total_no_of_cars, doc.custom_number_of_cars
                    )
                )
            else:
                frappe.throw(
                    "Total quantity of cars ({0}) does not match the declared number of cars ({1}). "
                    "Please make sure these values are consistent.".format(total_no_of_cars, doc.custom_number_of_cars)
                )


def check_duplicate_tax_or_national_id(doc, user_lang):
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
            if user_lang == "ar":
                frappe.throw(
                    "يوجد عميل ({0}) بنفس الرقم الضريبي، تم إنشاؤه بواسطة المستخدم: {1}.".format(
                        lead_name, owner
                    )
                )
            else:
                frappe.throw(
                    "A Lead ({0}) already exists with the same Tax ID, created by user: {1}.".format(
                        lead_name, owner
                    )
                )
    elif doc.type == "Individual" and doc.custom_national_id:
        existing = frappe.db.get_value(
            "Lead",
            {"custom_national_id": doc.custom_national_id, "name": ["!=", doc.name]},
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            if user_lang == "ar":
                frappe.throw(
                    "يوجد عميل ({0}) بنفس رقم الهوية الوطنية، تم إنشاؤه بواسطة المستخدم: {1}.".format(
                        lead_name, owner
                    )
                )
            else:
                frappe.throw(
                    "A Lead ({0}) already exists with the same National ID, created by user: {1}.".format(
                        lead_name, owner
                    )
                )

def check_duplicate_mobile_or_email(doc, user_lang):
    """
    Check for duplicate mobile numbers or email IDs.
    """
    if doc.mobile_no:
        # Check for duplicate mobile number
        existing = frappe.db.get_value(
            "Lead",
            {"mobile_no": doc.mobile_no, "name": ["!=", doc.name]},
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            # Allow duplicate if the owner matches the current session user
            if owner != frappe.session.user:
                if user_lang == "ar":
                    frappe.throw(
                        "رقم الهاتف موجود بالفعل في العميل: {0} (تم إنشاؤه بواسطة: {1})".format(
                            lead_name, frappe.db.get_value("User", owner, "full_name")
                        )
                    )
                else:
                    frappe.throw(
                        "Mobile number already exists in Lead: {0} (Created by: {1})".format(
                            lead_name, frappe.db.get_value("User", owner, "full_name")
                        )
                    )

    if doc.email_id:
        # Check for duplicate email ID
        existing = frappe.db.get_value(
            "Lead",
            {"email_id": doc.email_id, "name": ["!=", doc.name]},
            ["name", "owner"]
        )
        if existing:
            lead_name, owner = existing
            # Allow duplicate if the owner matches the current session user
            if owner != frappe.session.user:
                if user_lang == "ar":
                    frappe.throw(
                        "البريد الإلكتروني موجود بالفعل في العميل: {0} (تم إنشاؤه بواسطة: {1})".format(
                            lead_name, frappe.db.get_value("User", owner, "full_name")
                        )
                    )
                else:
                    frappe.throw(
                        "Email ID already exists in Lead: {0} (Created by: {1})".format(
                            lead_name, frappe.db.get_value("User", owner, "full_name")
                        )
                    )