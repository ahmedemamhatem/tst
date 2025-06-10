# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
from geopy.geocoders import Nominatim

class LeadVisit(Document):
    def before_save(self):
        if self.latitude and self.longitude:
            try:
                # Initialize geolocator with user agent
                geolocator = Nominatim(user_agent="frappe_map")

                # Reverse geocode to get location details in Arabic
                location = geolocator.reverse(f"{self.latitude}, {self.longitude}", language='ar')
                addr = getattr(location, "raw", {}).get('address', {}) if location else {}

                # Extract address components in Arabic
                road = addr.get('road') or ''
                city = (
                    addr.get('city') or
                    addr.get('town') or
                    addr.get('village') or
                    addr.get('municipality') or
                    addr.get('hamlet') or
                    addr.get('county') or
                    addr.get('state') or
                    "غير معروف"  # Arabic fallback for "Unknown"
                )
                state = addr.get('state') or ''
                country = addr.get('country') or ''
                postcode = addr.get('postcode') or ''
                neighborhood = addr.get('neighbourhood') or ''
                suburb = addr.get('suburb') or ''
                county = addr.get('county') or ''
                municipality = addr.get('municipality') or ''

                # Save detailed fields to the document
                self.city = city
                self.state = state
                self.country = country
                self.postal_code = postcode
                self.road = road
                self.neighborhood = neighborhood
                self.suburb = suburb
                self.county = county
                self.municipality = municipality
                self.address_line = location.address if location else ""

                # Format a compact, prioritized address string (Arabic)
                address_parts = [road, neighborhood, suburb, city, state, postcode, country]
                formatted = ', '.join([p for p in address_parts if p])
                self.address = formatted[:140]  # Truncate if needed

            except Exception as e:
                frappe.log_error(message=f"Failed to fetch Arabic address: {str(e)}", title="Geolocation Error")
                frappe.throw(_("Unable to fetch Arabic address. Please check the logs for more details."))