frappe.ui.form.on('Stock Entry', {
  setup: function(frm) {
    set_stock_entry_type_query(frm);
  },
  onload: function(frm) {
    set_stock_entry_type_query(frm);
  },
  refresh: function(frm) {
    set_stock_entry_type_query(frm);
  }
});

function set_stock_entry_type_query(frm) {
  console.log("Setting filter for stock_entry_type...");
  frm.set_query('stock_entry_type', function() {
    return {
      filters: {
        custom_enabled: 1
      }
    };
  });
}