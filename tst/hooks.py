# App Metadata
# ------------------
app_name = "tst"
app_title = "Tst"
app_publisher = "Ahmed Emam"
app_description = "TST Customizations"
app_email = "ahmedemamhatem@gmail.com"
app_license = "mit"

# ------------------
# Import and Initialization
# ------------------
from tst.override import monkey_patch_reorder_item

monkey_patch_reorder_item()

override_doctype_class = {"Lead": "tst.triggers.crm.lead.lead.CustomLead"}
# ------------------
# Document Events (doc_events)
# ------------------
doc_events = {
    "Product Bundle": {"validate": "tst.override.calculate_bundle_valuation"},
    "Purchase Receipt": {"on_submit": "tst.override.update_item_status_from_doc"},
    "Stock Entry": {
        "after_insert": "tst.triggers.stock.stock_entry.stock_entry.after_insert",
        "validate": "tst.triggers.stock.stock_entry.stock_entry.validate",
        "on_submit": "tst.override.update_item_status_from_doc",
    },
    "Quotation": {
        "validate": [
            "tst.override.set_main_warehouse_qty",
            "tst.override.validate_items_are_saleable",
            "tst.override.alert_supervisor_on_item_shortfall",
            "tst.override.validate_quotation_discount_limits",
        ]
    },
    "Sales Order": {"validate": "tst.override.validate_items_are_saleable"},
    "Lead": {"validate": "tst.triggers.crm.lead.lead.validate"},
    "Appointment": {
        "after_insert": "tst.triggers.crm.appointment.appointment.after_insert",
        "validate": "tst.triggers.crm.appointment.appointment.validate",
        "on_submit": "tst.triggers.crm.appointment.appointment.on_submit",
    },
    "Purchase Order": {
        "validate": "tst.triggers.buying.purchase_order.purchase_order.validate",
        "on_update_after_submit": "tst.triggers.buying.purchase_order.purchase_order.on_update_after_submit",
    },
    "Purchase Invoice": {
        "validate": "tst.triggers.buying.purchase_invoice.purchase_invoice.validate",
        "on_submit": "tst.triggers.buying.purchase_invoice.purchase_invoice.on_submit",
    },
    "Material Request": {
        "after_insert": [
            "tst.triggers.stock.material_request.material_request.after_insert",
            "tst.triggers.stock.material_request.material_request.set_department_in_items",
        ],
        "validate": [
            "tst.triggers.stock.material_request.material_request.validate",
            "tst.triggers.stock.material_request.material_request.set_department_in_items",
        ],
        "on_submit": "tst.triggers.stock.material_request.material_request.on_submit",
    },
}

# ------------------
# Doctype JS Includes
# ------------------
doctype_js = {
    "Lead": "triggers/crm/lead/lead.js",
    "Appointment": "triggers/crm/appointment/appointment.js",
    "Quotation": "triggers/selling/quotation/quotation.js",
    "Purchase Invoice": "triggers/buying/purchase_invoice/purchase_invoice.js",
    "Purchase Receipt": "public/js/upload_serials_pr.js",
    "Stock Reconciliation": "public/js/upload_serials_str.js",
    "Employee": "public/js/employee.js",
    "Sales Order": "triggers/selling/sales_order/sales_order.js",
    "Stock Entry": "triggers/stock/stock_entry/stock_entry.js",
}

# ------------------
# Fixtures
# ------------------
fixtures = [
    {"dt": "Custom Field", "filters": [["module", "=", "Tst"]]},
    {"dt": "Property Setter", "filters": [["module", "=", "Tst"]]},
    {
        "dt": "PO Types",
    },
]

# ------------------
# (Other sections are commented for future use)
# ------------------

# # required_apps = []

# # Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "tst",
# 		"logo": "/assets/tst/logo.png",
# 		"title": "Tst",
# 		"route": "/tst",
# 		"has_permission": "tst.api.permission.has_app_permission"
# 	}
# ]

# # Includes in <head>
# # ------------------
# # include js, css files in header of desk.html
# # app_include_css = "/assets/tst/css/tst.css"
# # app_include_js = "/assets/tst/js/tst.js"
# # include js, css files in header of web template
# # web_include_css = "/assets/tst/css/tst.css"
# # web_include_js = "/assets/tst/js/tst.js"
# # include custom scss in every website theme (without file extension ".scss")
# # website_theme_scss = "tst/public/scss/website"
# # include js, css files in header of web form
# # webform_include_js = {"doctype": "public/js/doctype.js"}
# # webform_include_css = {"doctype": "public/css/doctype.css"}
# # include js in page
# # page_js = {"page" : "public/js/file.js"}
# # include js in doctype views
# # doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# # doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# # doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}
# # Svg Icons
# # ------------------
# # app_include_icons = "tst/public/icons.svg"

# # Home Pages, Generators, Jinja, Installation, Uninstallation, Integration, Desk Notifications, Permissions, DocType Class, Scheduled Tasks, Testing, Overriding Methods, Document Events, User Data Protection, Authentication and authorization, etc.
# # (Uncomment and configure as needed)
