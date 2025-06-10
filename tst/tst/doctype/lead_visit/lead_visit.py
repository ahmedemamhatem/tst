# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from geopy.geocoders import Nominatim
from frappe import _


class LeadVisit(Document):
    def before_save(self):
        if self.latitude and self.longitude:
            try:
                # Initialize geolocator with user agent
                geolocator = Nominatim(user_agent="frappe_map")

                # Reverse geocode to get location details in Arabic
                location = geolocator.reverse(
                    f"{self.latitude}, {self.longitude}", language="ar"
                )
                addr = (
                    getattr(location, "raw", {}).get("address", {}) if location else {}
                )

                # Extract address components in Arabic
                road = addr.get("road") or "غير معروف"  # Default: Unknown in Arabic
                city = (
                    addr.get("city")
                    or addr.get("state")
                    or "غير معروف"  # Default: Unknown
                )
                state = addr.get("state") or "غير معروف"
                country = addr.get("country") or "غير معروف"
                postcode = addr.get("postcode") or "غير معروف"
                neighborhood = addr.get("neighbourhood") or "غير معروف"
                suburb = addr.get("suburb") or "غير معروف"
                county = addr.get("county") or "غير معروف"
                municipality = addr.get("municipality") or "غير معروف"

                # Save detailed fields to the document
                self.city = self.city or city
                self.state = self.state or state
                self.country = self.country or country
                self.postal_code = self.postal_code or postcode
                self.road = self.road or road
                self.neighborhood = self.neighborhood or neighborhood
                self.suburb = self.suburb or suburb
                self.county = self.county or county
                self.municipality = self.municipality or municipality
                self.address_line = self.address_line or (
                    location.address if location else "غير معروف"
                )

                # Format a compact, prioritized address string (Arabic)
                address_parts = [
                    road,
                    neighborhood,
                    suburb,
                    city,
                    state,
                    postcode,
                    country,
                ]
                formatted = ", ".join([p for p in address_parts if p])
                self.address = self.address or formatted[:140]  # Truncate if needed

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
