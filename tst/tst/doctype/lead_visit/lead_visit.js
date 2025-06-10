// Copyright (c) 2025, Ahmed Emam and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Lead Visit", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('Lead Visit', {
    onload: function(frm) {
        if (frm.doc.latitude && frm.doc.longitude) {
            const latitude = frm.doc.latitude;
            const longitude = frm.doc.longitude;

            // Embed a map in the geolocation_xuqf field
            const mapHTML = `
                <div id="map" style="width: 100%; height: 300px;"></div>
                <script>
                    // Initialize the map
                    const map = L.map('map').setView([${latitude}, ${longitude}], 13);

                    // Add OpenStreetMap tiles
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                    }).addTo(map);

                    // Add a marker at the current location
                    L.marker([${latitude}, ${longitude}]).addTo(map)
                        .bindPopup('You are here!').openPopup();
                </script>
            `;

            // Set the HTML content of the geolocation_xuqf field
            frm.fields_dict.geolocation_xuqf.$wrapper.html(mapHTML);
        }
    }
});