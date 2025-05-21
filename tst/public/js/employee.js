frappe.ui.form.on('Employee', {
    refresh: function(frm) {
        if(frm.doc.name && !frm.is_new()) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Asset",
                    fields: ["name", "asset_name", "location"],
                    filters: {
                        "custodian": frm.doc.name  // or "employee" depending on your ERPNext version
                    },
                    limit_page_length: 100
                },
                callback: function(r) {
                    let html = `<table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Asset ID</th>
                                <th>Name</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>`;
                    if(r.message && r.message.length) {
                        r.message.forEach(row => {
                            html += `<tr>
                                <td>${frappe.utils.escape_html(row.name)}</td>
                                <td>${frappe.utils.escape_html(row.asset_name || '')}</td>
                                <td>${frappe.utils.escape_html(row.location || '')}</td>
                            </tr>`;
                        });
                    } else {
                        html += `<tr><td colspan="3" class="text-center text-muted">No Assets Assigned</td></tr>`;
                    }
                    html += `</tbody></table>`;
                    frm.fields_dict.custom_employee_assets.$wrapper.html(html);
                }
            });
        } else {
            frm.fields_dict.custom_employee_assets.$wrapper.html(
                `<p class="text-muted">Save the Employee profile to see assigned assets.</p>`
            );
        }
    }
});