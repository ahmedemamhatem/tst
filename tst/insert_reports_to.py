import frappe

BATCH_SIZE = 100

def get_target_doctypes():
    doctypes = frappe.get_all(
        "DocType",
        filters={"issingle": 0, "istable": 0},
        fields=["name"]
    )
    exclude = set([
        "DocType", "DocField", "DocPerm", "DocType Action", "DocType Link",
        "File", "Communication", "Version", "Deleted Document", "Prepared Report", "Scheduled Job Log"
    ])
    return [d.name for d in doctypes if d.name not in exclude]

def ensure_reports_to_user_field(doctype):
    cf = frappe.get_value(
        "Custom Field",
        {"dt": doctype, "fieldname": "reports_to_user"},
        "name"
    )
    if cf:
        doc = frappe.get_doc("Custom Field", cf)
        changed = False
        if doc.fieldtype != "Link":
            doc.fieldtype = "Link"
            changed = True
        if doc.options != "User":
            doc.options = "User"
            changed = True
        if not doc.read_only:
            doc.read_only = 1
            changed = True
        if doc.ignore_user_permissions !=1:
            doc.ignore_user_permissions = 1
            changed = True
        if doc.hidden:
            doc.hidden = 0
            changed = True
        if doc.insert_after != "owner":
            doc.insert_after = "owner"
            changed = True
        if not doc.no_copy:
            doc.no_copy = 1
            changed = True
        if not doc.print_hide:
            doc.print_hide = 1
            changed = True
        if changed:
            doc.save()
            frappe.db.commit()
        else:
            print(f"reports_to_user field already correctly configured in {doctype}.")
    else:
        cf_doc = frappe.get_doc({
            "doctype": "Custom Field",
            "dt": doctype,
            "fieldname": "reports_to_user",
            "label": "Reports To User",
            "fieldtype": "Link",
            "options": "User",
            "insert_after": "owner",
            "read_only": 1,
            "ignore_user_permissions": 1,
            "hidden": 0,
            "no_copy": 1,
            "print_hide": 1,
        })
        cf_doc.save()
        frappe.db.commit()

def get_records_to_update(doctype, start, batch_size):
    return frappe.get_all(
        doctype,
        filters={"reports_to_user": ["is", "not set"]},
        fields=["name", "owner"],
        limit_start=start,
        limit_page_length=batch_size
    )

def batch_update_reports_to_user(doctype):
    total = frappe.db.count(doctype, {"reports_to_user": ["is", "not set"]})
    print(f"{doctype}: {total} records to update in batches of {BATCH_SIZE}")
    for start in range(0, total, BATCH_SIZE):
        records = get_records_to_update(doctype, start, BATCH_SIZE)
        updated = 0
        for rec in records:
            owner = rec.owner
            emp = frappe.get_value("Employee", {"user_id": owner}, ["name", "reports_to"])
            if emp and emp[1]:
                reports_to_user_id = frappe.get_value("Employee", emp[1], "user_id")
                if reports_to_user_id:
                    try:
                        frappe.db.set_value(
                            doctype,
                            rec.name,
                            "reports_to_user",
                            reports_to_user_id,
                            update_modified=False
                        )
                        updated += 1
                    except Exception as e:
                        print(f"Failed to update {doctype} {rec.name}: {e}")
        frappe.db.commit()

def run():
    doctypes = get_target_doctypes()
    for dt in doctypes:
        try:
            ensure_reports_to_user_field(dt)
            batch_update_reports_to_user(dt)
        except Exception as e:
            print(f"Error processing {dt}: {e}")