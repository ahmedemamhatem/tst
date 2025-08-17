frappe.ui.form.on("Device Setup", {
    serial_no: function(frm) {
        frappe.msgprint("")
        if (frm.doc.serial_no) {
            frappe.msgprint("tst")
            // First fetch item_code from Serial No doctype
            frappe.db.get_value("Serial No", frm.doc.serial_no, "item_code")
                .then(r => {
                    if (r.message && r.message.item_code) {
                        let item_code = r.message.item_code;

                        // Now fetch device_type from Item doctype
                        frappe.db.get_value("Item", item_code, "custom_device_type")
                            .then(res => {
                                if (res.message && res.message.device_type) {
                                    frm.set_value("device_type", res.message.device_type);
                                } else {
                                    frm.set_value("device_type", "");
                                }
                            });
                    } else {
                        frm.set_value("device_type", "");
                    }
                });
        } else {
            frm.set_value("device_type", "");
        }
    }
});
