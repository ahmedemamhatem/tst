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

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/tst/css/tst.css"
# app_include_js = "/assets/tst/js/tst.js"

# include js, css files in header of web template
# web_include_css = "/assets/tst/css/tst.css"
# web_include_js = "/assets/tst/js/tst.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "tst/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {"Lead" : "triggers/crm/lead/lead.js",
              "Quotation": "triggers/selling/quotation/quotation.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "tst/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "tst.utils.jinja_methods",
# 	"filters": "tst.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "tst.install.before_install"
# after_install = "tst.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "tst.uninstall.before_uninstall"
# after_uninstall = "tst.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "tst.utils.before_app_install"
# after_app_install = "tst.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "tst.utils.before_app_uninstall"
# after_app_uninstall = "tst.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "tst.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }
fixtures = [
    {"dt": "Custom Field", "filters": [["module", "=", "Tst"]]},
    {"dt": "Property Setter", "filters": [["module", "=", "Tst"]]},
]

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"tst.tasks.all"
# 	],
# 	"daily": [
# 		"tst.tasks.daily"
# 	],
# 	"hourly": [
# 		"tst.tasks.hourly"
# 	],
# 	"weekly": [
# 		"tst.tasks.weekly"
# 	],
# 	"monthly": [
# 		"tst.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "tst.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "tst.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "tst.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["tst.utils.before_request"]
# after_request = ["tst.utils.after_request"]

# Job Events
# ----------
# before_job = ["tst.utils.before_job"]
# after_job = ["tst.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"tst.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# # Home Pages, Generators, Jinja, Installation, Uninstallation, Integration, Desk Notifications, Permissions, DocType Class, Scheduled Tasks, Testing, Overriding Methods, Document Events, User Data Protection, Authentication and authorization, etc.
# # (Uncomment and configure as needed)
