# Copyright (c) 2025, Ahmed Emam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from geopy.geocoders import Nominatim
from frappe import _


class LeadVisit(Document):
    def before_save(self):
        if self.latitude and self.longitude:
            if any([
                self.city, self.state, self.country, self.postal_code,
                self.road, self.neighborhood, self.suburb,
                self.county, self.municipality, self.address_line, self.address
                ]):
                return
            try:
                geolocator = Nominatim(user_agent="frappe_map")
                location = geolocator.reverse(
                    f"{self.latitude}, {self.longitude}", language="ar"
                )
                addr = (
                    getattr(location, "raw", {}).get("address", {}) if location else {}
                )

                road = addr.get("road") or ""
                city = addr.get("city") or addr.get("state") or ""
                state = addr.get("state") or ""
                country = addr.get("country") or ""
                postcode = addr.get("postcode") or ""
                neighborhood = addr.get("neighbourhood") or ""
                suburb = addr.get("suburb") or ""
                county = addr.get("county") or ""
                municipality = addr.get("municipality") or ""

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
                    location.address if location else ""
                )

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
                self.address = self.address or formatted[:140]

            except Exception as e:
                frappe.log_error(
                    message=f"Failed to fetch Arabic address: {str(e)}",
                    title="Geolocation Error",
                )
                frappe.throw(
                    _(
                        "Unable to fetch Arabic address. Please check the logs for more details."
                    )
                )

    def after_insert(self):
        self._share_with_creator_reporters()

    def validate(self):
        # Optional: only re-share if needed during update
        self._share_with_creator_reporters()

    def _share_with_creator_reporters(self):
        """Share this document with all managers of the creator."""
        if self.is_new():
            return
        try:
            creator_user = self.owner
            reporters = self._get_all_reporters(creator_user)

            for user_id in reporters:
                self._share_document_with_user(user_id)

        except Exception:
            frappe.log_error(frappe.get_traceback(), "LeadVisit Share Error")

    def _get_all_reporters(self, start_user_id):
        """Return a list of user_ids for all managers up the chain."""
        reporters = []
        visited = set()

        current_emp = frappe.db.get_value(
            "Employee", {"user_id": start_user_id}, ["name", "reports_to"], as_dict=True
        )

        while current_emp and current_emp.reports_to and current_emp.reports_to not in visited:
            visited.add(current_emp.reports_to)

            manager = frappe.db.get_value(
                "Employee", current_emp.reports_to,
                ["name", "user_id", "reports_to"], as_dict=True
            )
            if manager and manager.user_id:
                reporters.append(manager.user_id)

            current_emp = manager

        return reporters

    def _share_document_with_user(self, user_id):
        """Share doc with a given user_id if not already shared."""
        frappe.share.add(
            doctype=self.doctype,
            name=self.name,
            user=user_id,
            read=1,
            write=0,
            share=0
        )
