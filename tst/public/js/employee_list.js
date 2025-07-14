frappe.listview_settings['Employee'] = {
    get_indicator: function(doc) {
        if (doc._field_percent === undefined) {
            console.log(`[Employee: ${doc.name}] Percent not fetched`);

            if (!doc._fetching_percent) {
                doc._fetching_percent = true;

                frappe.call({
                    method: "tst.api.get_employee_field_percent",
                    args: { employee_id: doc.name },
                    callback: function(r) {
                        console.log("API result:", r);
                        if (r && r.message) {
                            doc._field_percent = r.message.percent;
                            if (frappe.listview && frappe.listview.list_view) {
                                frappe.listview.list_view.refresh();
                            }
                        }
                    }
                });
            }

            return ['Checking...', 'gray', ''];
        }

        let percent = doc._field_percent;
        let color = percent >= 80 ? 'green' :
                    percent >= 60 ? 'blue' :
                    percent >= 30 ? 'yellow' : 'red';

        let label = `Fields Filled: ${percent}%`;
        console.log(`[Employee: ${doc.name}] ${label}`);
        return [label, color, ''];
    }
};
