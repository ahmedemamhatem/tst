frappe.ui.form.on('Purchase Invoice', {
    refresh: function(frm) {
        if (frm.doc.docstatus === 1){
            if (frm.doc.custom_landed_cost === 1) {
                frm.add_custom_button(
                    __('Create Landed Cost Voucher'),
                    function() {
                        frm.events.create_landed_cost_voucher(frm);
                    });
            }else if (frm.doc.custom_landed_cost === 0) {
                frappe.confirm(
                                    __(
                                        "Create Landed Cost Voucher for this Purchase Invoice?"
                                    ),
                                    () => {
        frappe.call({
            method: 'frappe.client.set_value',
            args: {
                doctype: 'Purchase Invoice',
                name: frm.doc.name,
                fieldname: 'custom_landed_cost',
                value: 1
            },
            callback: function(r) {
                if (!r.exc) {
                    frm.reload_doc();
                    frappe.show_alert({message: __('Updated'), indicator:'green'});
                }
            }
        });
    }
);
            };
        }
            
        },
    create_landed_cost_voucher: function(frm) {
		frappe.call({
			method: "erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_lcv",
			args: {
				doctype: frm.doc.doctype,
				docname: frm.doc.name,
			},
			callback: (r) => {
				if (r.message) {
					var doc = frappe.model.sync(r.message);
					frappe.set_route("Form", doc[0].doctype, doc[0].name);
				}
			},
		});
	
    },
});