frappe.ui.form.on('Request for Quotation', {
    setup(frm) {
        // Optionally run when the form is first loaded (not after save)
    },
    onload(frm) {
        // Create a set to track unique suppliers
        let suppliers_set = new Set();

        // Loop through items to collect unique default suppliers
        (frm.doc.items || []).forEach(item => {
            if (item.custom_default_supplier) {
                suppliers_set.add(item.custom_default_supplier);
            }
        });

        // Loop through existing suppliers to avoid duplicates
        let existing_suppliers = new Set();
        (frm.doc.suppliers || []).forEach(row => {
            if (row.supplier) {
                existing_suppliers.add(row.supplier);
            }
        });

        // Add missing suppliers to the suppliers child table
        suppliers_set.forEach(supplier => {
            if (!existing_suppliers.has(supplier)) {
                frm.add_child('suppliers', {
                    supplier: supplier,
                    supplier_name: supplier // Modify if you want to fetch real supplier name
                });
            }
        });

        // Refresh the suppliers table to show changes
        frm.refresh_field('suppliers');
    }
});
