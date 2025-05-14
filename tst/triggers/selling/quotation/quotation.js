frappe.ui.form.on('Quotation', {
    onload: function(frm) {
        // Check if the document is in draft (docstatus === 0)
        if (frm.doc.docstatus === 0) {
            // Hide the print button
            $("button[data-original-title=Print]").hide();
        }
    },
    refresh: function(frm) {
        // Check if the document is in draft (docstatus === 0)
        if (frm.doc.docstatus === 0) {
            // Hide the print button again during refresh
            $("button[data-original-title=Print]").hide();
        }
    },
});
