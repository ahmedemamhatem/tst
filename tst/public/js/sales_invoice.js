frappe.ui.form.on('Sales Invoice', {
    onload(frm) {
        toggle_items_table(frm);
    },
    refresh(frm) {
        toggle_items_table(frm);
    },
    custom_product_bundle(frm) {
        toggle_items_table(frm);
    },
    validate(frm) {
        toggle_items_table(frm);
    }
});

function toggle_items_table(frm) {
    if (frm.doc.custom_product_bundle) {
        frm.set_df_property('items', 'reqd', 0);
        frm.set_df_property('items', 'read_only', 1);
    } else {
        frm.set_df_property('items', 'reqd', 1);
        frm.set_df_property('items', 'read_only', 0);
    }
}