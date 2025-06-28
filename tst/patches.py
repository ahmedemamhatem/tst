import frappe

def execute():
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
        cf = frappe.get_value("Custom Field", {"dt": doctype, "fieldname": "reports_to_user"}, "name")
        if cf:
            doc = frappe.get_doc("Custom Field", cf)
            changed = False
            # Update to Data field
            if doc.fieldtype != "Data":
                doc.fieldtype = "Data"
                changed = True
            # Remove Link options if present
            if doc.options:
                doc.options = ""
                changed = True
            # Set read_only to True
            if not doc.read_only:
                doc.read_only = 1
                changed = True
            # Make sure the field is visible (not hidden)
            if doc.hidden:
                doc.hidden = 0
                changed = True
            if changed:
                doc.save()
                frappe.db.commit()
                print(f"Updated reports_to_user field in {doctype}.")
            else:
                print(f"reports_to_user field already correctly configured in {doctype}.")
        else:
            cf_doc = frappe.get_doc({
                "doctype": "Custom Field",
                "dt": doctype,
                "fieldname": "reports_to_user",
                "label": "Reports To User",
                "fieldtype": "Data",        # Data field type
                "options": "",              # No options for Data field
                "insert_after": "owner",
                "read_only": 1,
                "hidden": 0,                # Not hidden
                "no_copy": 1,
                "print_hide": 1,
            })
            cf_doc.save()
            frappe.db.commit()
            print(f"Created reports_to_user field in {doctype}.")

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
            print(f"Batch {start} - {start+len(records)-1}: {updated} records updated.")

    doctypes = get_target_doctypes()
    for dt in doctypes:
        try:
            ensure_reports_to_user_field(dt)
            batch_update_reports_to_user(dt)
        except Exception as e:
            print(f"Error processing {dt}: {e}")