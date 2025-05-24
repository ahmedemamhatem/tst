frappe.ui.form.on('Sales Order', {
    refresh: function (frm) {
        if (!frm.doc.__islocal && frm.doc.docstatus == 1) {
            frm.add_custom_button(__('Installation Order'), function () {
                frappe.model.open_mapped_doc({
                    method: 'tst.triggers.selling.sales_order.sales_order.make_installation_order',
                    frm: frm
                });
            }, __('Create'));
        }
    }
});
