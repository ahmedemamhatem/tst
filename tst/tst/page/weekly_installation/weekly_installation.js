frappe.pages['weekly-installation'].on_page_load = function(wrapper) {
    // PAGE SETUP
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: '',
        single_column: true
    });
    $(wrapper).find('.page-head, .page-head-content, .page-title').remove();
    $(page.body).css({margin:0, padding:0, background:'#f6f8fa', 'min-height':'100vh', 'overflow-x':'hidden'});

    // MODERN CSS
    $(`<style>
        .wi-header-summary {
            display: flex; align-items: center; gap: 16px; background: #f6f8fa; padding: 8px 16px 4px 8px; margin-bottom: 2px;
            border-radius: 8px; font-size:15px; font-weight:500;
        }
        .wi-header-summary .wi-week-label { font-size: 15px; color: #1976d2; font-weight: 600; letter-spacing:0.7px; margin-right:8px;}
        .wi-header-summary .wi-count {
            background: #fff; color: #1976d2; border-radius: 12px; padding: 2px 10px; font-size: 13px; margin-right:6px; border:1px solid #e3eafc;
        }
        .wi-header-summary .wi-refresh-btn {
            margin-left:auto; background: #1976d2; color: #fff; border:none; border-radius:5px; font-size:13px; padding:4px 14px; transition:.2s;
        }
        .wi-header-summary .wi-refresh-btn:hover { background: #1451a7;}
        .wi-board { display: grid; grid-template-columns: repeat(7, 1fr); gap: 16px; margin-top: 0;}
        .wi-day-col {
            background: #fff; border-radius: 9px; box-shadow: 0 2px 8px 0 rgba(50,60,130,0.07);
            border: 1.2px solid #dde7f5; min-width: 0; display: flex; flex-direction: column;
            min-height: 200px; transition:.2s;
        }
        .wi-day-header {
            font-weight: bold; color: #1976d2; background: #f3f6fb; border-radius:8px 8px 0 0;
            padding: 10px 12px 7px 13px; border-bottom: 1px solid #e6eaf6; letter-spacing:0.8px;
        }
        .wi-order-list { flex: 1; overflow-y: auto; min-height: 30px; padding-bottom:10px;}
        .wi-order-card {
            margin:11px 10px 0 10px; background: #f7faff; border-radius: 11px; padding:13px 16px 11px 16px;
            font-size: 15px; border-left: 6px solid #1976d2; border: 1.2px solid #e3eafc; cursor: pointer;
            transition: box-shadow .15s, border-color .2s; position:relative; box-shadow:0 1.5px 7px rgba(40,60,140,.05);
            display: flex; flex-direction: column; gap:5px;
        }
        .wi-order-card[data-status="Completed"] { border-left-color: #43be7f;}
        .wi-order-card[data-status="In Progress"] { border-left-color: #f3b13f;}
        .wi-order-card[data-status="Pending"] { border-left-color: #e74c3c;}
        .wi-order-card:hover {
            box-shadow: 0 6px 28px rgba(30,60,120,0.13); border-color: #a3c8ff;
            z-index:3;
        }
        .wi-card-row { display: flex; align-items: center; gap: 10px; }
        .wi-tech-row { display:flex; align-items:center; gap:8px; font-size:13.5px; color:#373e56; margin-top:2px;}
        .wi-avatar {
            width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center;
            font-size:15px; font-weight:600; background:#e8eefa; color:#1976d2; text-transform:uppercase;
            border:1.5px solid #c9e6ff;
        }
        .wi-time-row {
            display:flex; gap:8px; align-items:center; font-size:14px; margin-top:2px;
        }
        .wi-time-badge, .wi-date-badge {
            background:#f3f6fb; color:#1976d2; border-radius:8px; padding:2px 10px; font-weight:600; font-size:1.01em;
            min-width:65px; text-align:center;
        }
        .wi-items-row {
            font-size:12px; color:#1976d2; font-weight:500; letter-spacing:0.09em; margin-top:1px;
        }
        .wi-subtech-row {
            margin-left: 36px; margin-top:3px; font-size:12.5px; color:#1976d2; display:flex; gap:7px; flex-wrap:wrap;
        }
        .wi-order-card .wi-actions {
            position:absolute; top:7px; right:7px; z-index:2;
        }
        .wi-order-card .wi-act-btn {
            background: #f0f7ff; color: #1976d2; border: none; border-radius: 4px; font-size: 13px;
            padding: 2px 9px; margin-left:3px; cursor:pointer; transition:.13s;
        }
        .wi-order-card .wi-act-btn:hover { background:#c9e0ff;}
        .wi-day-col.wi-drop-hint {border:2.5px dashed #1976d2;}
        .wi-shimmer {
            margin: 24px 0 0 0; display: flex; gap: 9px; width:100%;
        }
        .wi-shimmer-col {
            background: #f4f5fa; border-radius:9px; flex:1; height:110px; position:relative; overflow:hidden;
        }
        .wi-shimmer-anim {
            animation: shimmer 1.2s infinite linear;
            background: linear-gradient(90deg, #f4f5fa 25%, #e8ebf8 50%, #f4f5fa 75%);
            background-size: 200% 100%;
            position: absolute; top:0; left:0; right:0; bottom:0;
        }
        @keyframes shimmer {
            0% {background-position: -200% 0;}
            100% {background-position: 200% 0;}
        }
        @media (max-width:1100px) {.wi-board{grid-template-columns: repeat(2,1fr);}}
        @media (max-width:700px) {.wi-board{grid-template-columns: 1fr;}}
        .wi-filter-bar {
            background:#fff; border-radius:8px; padding:12px 12px 6px 12px; display:flex; gap:15px; align-items:center;
            box-shadow:0 1px 3px rgba(0,0,0,0.045); margin-bottom:13px; margin-top:7px; flex-wrap:wrap;
        }
        .wi-filter-label {font-size:13px; color:#1976d2; font-weight:600; margin-right:2px;}
        .wi-filter-bar .form-control {min-width:120px;}
    </style>`).appendTo('head');

    // HEADER SUMMARY
    const header = $(`
        <div class="wi-header-summary">
            <span class="wi-week-label"></span>
            <span class="wi-count"></span>
            <button class="wi-refresh-btn"><i class="fa fa-refresh"></i> Refresh</button>
        </div>
    `);
    $(page.body).append(header);

    // FILTER BAR
    const filterBar = $(`
        <div class="wi-filter-bar">
            <span class="wi-filter-label">Week:</span>
            <div class="wi-control-wrapper wi-start-date"></div>
            <span class="wi-filter-label">Technician:</span>
            <div class="wi-control-wrapper wi-technician"></div>
            <span class="wi-filter-label">Customer:</span>
            <div class="wi-control-wrapper wi-customer"></div>
        </div>
    `);
    $(page.body).append(filterBar);

    // MAIN BOARD
    const board = $(`<div class="wi-board"></div>`);
    $(page.body).append(board);

    // CONTROLS (Frappe controls)
    const today = frappe.datetime.nowdate();
    const last_saturday = frappe.datetime.add_days(
        today,
        -((frappe.datetime.str_to_obj(today).getDay() + 1) % 7)
    );
    const startDateControl = frappe.ui.form.make_control({
        df: {
            fieldtype: "Date",
            fieldname: "start_date",
            placeholder: "Week Start Date"
        },
        parent: filterBar.find('.wi-start-date'),
        render_input: true
    });
    startDateControl.set_value(last_saturday);
    const technicianControl = frappe.ui.form.make_control({
        df: {
            fieldtype: "Link",
            fieldname: "technician",
            options: "Technician", // update as needed
            placeholder: "Technician"
        },
        parent: filterBar.find('.wi-technician'),
        render_input: true
    });
    const customerControl = frappe.ui.form.make_control({
        df: {
            fieldtype: "Link",
            fieldname: "customer",
            options: "Customer",
            placeholder: "Customer"
        },
        parent: filterBar.find('.wi-customer'),
        render_input: true
    });

    // SHIMMER LOADING
    function show_shimmer() {
        board.html('<div class="wi-shimmer">' +
            Array(7).fill('<div class="wi-shimmer-col"><div class="wi-shimmer-anim"></div></div>').join('') +
            '</div>');
    }

    // LOAD BOARD FUNCTION
    function load_board() {
        show_shimmer();
        const start_date = startDateControl.get_value();
        const technician = technicianControl.get_value();
        const customer = customerControl.get_value();
        let week_start = frappe.datetime.str_to_obj(start_date || today);
        let week_end = frappe.datetime.add_days(week_start, 6);
        let week_label = frappe.datetime.str_to_user(frappe.datetime.obj_to_str(week_start)) + ' - ' +
                         frappe.datetime.str_to_user(frappe.datetime.obj_to_str(week_end));
        header.find('.wi-week-label').text(week_label);
        header.find('.wi-count').text("");

        if (!start_date) {
            board.html(`<div style="padding:30px;text-align:center;color:#888;font-size:15px;">Select the week start date (Saturday)</div>`);
            return;
        }

        frappe.call({
            method: 'tst.tst.page.weekly_installation.weekly_installation.get_installation_orders_by_week',
            args: {start_date, technician, customer},
            freeze: false,
            callback: function(r) {
                board.empty();
                if (!r.message || Object.keys(r.message).length === 0) {
                    board.html(`<div style="padding:32px 8px;text-align:center;color:#888;font-size:16px;">No installation orders found for this week.</div>`);
                    header.find('.wi-count').text("0 orders");
                    return;
                }
                const week = r.message;
                let total_orders = 0;
                const week_dates = Object.keys(week);
                week_dates.forEach(day => {
                    const dateObj = frappe.datetime.str_to_obj(day);
                    const dayShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dateObj.getDay()];
                    const dayStr = `${dayShort} ${frappe.datetime.str_to_user(day)}`;
                    const col = $(`
                        <div class="wi-day-col" data-date="${day}" tabindex="0">
                            <div class="wi-day-header">${dayStr}</div>
                            <div class="wi-order-list"></div>
                        </div>
                    `);

                    const list = col.find('.wi-order-list');
                    (week[day] || []).forEach(order => {
                        total_orders++;
                        // Format date/time
                        let time = "-", date = "-";
                        if(order.scheduled_time) {
                            if (typeof order.scheduled_time === "string") {
                                let split = order.scheduled_time.split(" ");
                                date = split[0];
                                time = split[1]?.slice(0,5);
                            } else {
                                const dtstr = frappe.datetime.str_to_user(order.scheduled_time);
                                [date, time] = dtstr.split(" ");
                            }
                        }
                        // Avatars
                        function initials(name) {
                            if(!name) return "?";
                            return name.split(" ").map(w=>w[0]).join("").substr(0,2).toUpperCase();
                        }
                        let status = "Pending";
                        if(order.docstatus==1) status = "Completed";
                        if(order.docstatus==0 && order.scheduled_time) status = "In Progress";

                        // Show sub technicians if present
                        let subtech_html = "";
                        if(order.sub_technicians && order.sub_technicians.length) {
                            subtech_html = `<div class="wi-subtech-row" title="Sub Technicians">
                                ${order.sub_technicians.map(st=>`
                                    <span><i class="fa fa-user"></i> ${frappe.utils.escape_html(st.employee_name || st.employee)}</span>
                                `).join('')}
                            </div>`;
                        }

                        const card = $(`
                            <div class="wi-order-card" draggable="true" data-name="${order.name}" data-status="${status}">
                                <div class="wi-actions">
                                    <button class="wi-act-btn" title="Open in Form"><i class="fa fa-external-link"></i></button>
                                </div>
                                <div class="wi-card-row">
                                    <span class="wi-avatar" title="Technician">${initials(order.technician)}</span>
                                    <span>${frappe.utils.escape_html(order.technician||"-")}</span>
                                </div>
                                ${subtech_html}
                                <div class="wi-time-row">
                                    <span class="wi-date-badge" title="Scheduled Date">${date}</span>
                                    <span class="wi-time-badge" title="Scheduled Time">${time}</span>
                                </div>
                                <div class="wi-items-row">
                                    <i class="fa fa-list-ul"></i> ${order.items ? order.items.length : 0} items
                                </div>
                            </div>
                        `);

                        // Open in form
                        card.find('.wi-act-btn').on("click", function(e){
                            e.stopPropagation();
                            frappe.set_route("Form", "Installation Order", order.name);
                        });

                        // DRAG EVENTS
                        card.on("dragstart", e => {
                            e.originalEvent.dataTransfer.setData("order_name", order.name);
                            e.originalEvent.dataTransfer.setData("source_date", day);
                            card.css('opacity','0.6');
                        });
                        card.on("dragend", e => card.css('opacity','1'));

                        // DETAILS DIALOG (click)
                        card.on("click", function() {
                            frappe.call({
                                method: "frappe.client.get",
                                args: { doctype: "Installation Order", name: order.name },
                                callback: function(res) {
                                    if(res.exc_type && res.exc_type==="PermissionError") {
                                        frappe.msgprint({
                                            title: __("Not Permitted"),
                                            message: __("You do not have enough permissions to access this resource. Please contact your manager to get access."),
                                            indicator: "red"
                                        });
                                        return;
                                    }
                                    if (!res.message) {
                                        frappe.msgprint(__("Could not load details."));
                                        return;
                                    }
                                    const doc = res.message;
                                    // FLATTEN data for dialog tables
                                    let sub_techs = (doc.sub_technicians || []).map(row => ({
                                        employee: row.employee,
                                        employee_name: row.employee_name,
                                        designation: row.designation
                                    }));
                                    let items = (doc.items || []).map(row => ({
                                        item_code: row.item_code,
                                        item_name: row.item_name,
                                        description: row.description,
                                        qty: row.qty,
                                        uom: row.uom,
                                        warehouse: row.warehouse,
                                        serial_no: row.serial_no,
                                        rate: row.rate,
                                        amount: row.amount
                                    }));
                                    const dialog = new frappe.ui.Dialog({
                                        title: __("Installation Order Details"),
                                        fields: [
                                            {fieldtype:"Data", label:"Order Name", read_only:1, default:doc.name},
                                            {fieldtype:"Link", label:"Technician", fieldname:"technician", options:"Employee", default:doc.technician},
                                            {fieldtype:"Date", fieldname:"installation_date", label:"Installation Date", read_only:1, default:doc.installation_date},
                                            {fieldtype:"Datetime", fieldname:"scheduled_time", label:"Scheduled Time", default:doc.scheduled_time},
                                            {
                                                fieldtype:"Table",
                                                label:"Sub Technicians",
                                                fieldname:"sub_technicians",
                                                cannot_add_rows: 0,
                                                fields:[
                                                    {fieldtype:"Link", label:"Employee", fieldname:"employee", options:"Employee"},
                                                    {fieldtype:"Data", label:"Employee Name", fieldname:"employee_name"},
                                                    {fieldtype:"Data", label:"Designation", fieldname:"designation"}
                                                ],
                                                data: sub_techs
                                            },
                                            {
                                                fieldtype:"Table",
                                                label:"Items",
                                                fieldname:"items",
                                                read_only:1,
                                                fields:[
                                                    {fieldtype:"Data", label:"Item Code", fieldname:"item_code", read_only:1},
                                                    {fieldtype:"Data", label:"Item Name", fieldname:"item_name", read_only:1},
                                                    {fieldtype:"Data", label:"Description", fieldname:"description", read_only:1},
                                                    {fieldtype:"Float", label:"Qty", fieldname:"qty", read_only:1},
                                                    {fieldtype:"Data", label:"UOM", fieldname:"uom", read_only:1},
                                                    {fieldtype:"Data", label:"Warehouse", fieldname:"warehouse", read_only:1},
                                                    {fieldtype:"Data", label:"Serial No", fieldname:"serial_no", read_only:1},
                                                    {fieldtype:"Currency", label:"Rate", fieldname:"rate", read_only:1},
                                                    {fieldtype:"Currency", label:"Amount", fieldname:"amount", read_only:1}
                                                ],
                                                data: items
                                            }
                                        ],
                                        primary_action_label: __("Save"),
                                        primary_action(values) {
                                            dialog.hide();
                                            frappe.call({
                                                method: "tst.tst.page.weekly_installation.weekly_installation.update_order_fields",
                                                args: {
                                                    order_name: doc.name,
                                                    technician: values.technician,
                                                    scheduled_time: values.scheduled_time,
                                                    sub_technicians: values.sub_technicians || []
                                                },
                                                freeze: true,
                                                freeze_message: __("Updating details..."),
                                                callback: function(ret) {
                                                    if(ret.message && ret.message.success) {
                                                        frappe.show_alert(__("Order updated"));
                                                        load_board();
                                                    } else {
                                                        frappe.msgprint(__("Failed to update order."));
                                                    }
                                                }
                                            });
                                        }
                                    });
                                    dialog.show();
                                },
                                error: function() {
                                    frappe.msgprint({
                                        title: __("Not Permitted"),
                                        message: __("You do not have enough permissions to access this resource. Please contact your manager to get access."),
                                        indicator: "red"
                                    });
                                }
                            });
                        });

                        list.append(card);
                    });

                    // DROP EVENTS
                    col.on("dragover", function(e) { e.preventDefault(); col.addClass('wi-drop-hint'); });
                    col.on("dragleave", function(e) { col.removeClass('wi-drop-hint'); });
                    col.on("drop", function(e) {
                        e.preventDefault();
                        col.removeClass('wi-drop-hint');
                        const order_name = e.originalEvent.dataTransfer.getData("order_name");
                        const source_date = e.originalEvent.dataTransfer.getData("source_date");
                        const new_date = col.data("date");
                        if (!order_name || source_date === new_date) return;

                        frappe.call({
                            method: "tst.tst.page.weekly_installation.weekly_installation.move_installation_order",
                            args: { order_name, new_date },
                            freeze: true,
                            freeze_message: __('Updating installation date...'),
                            callback: function(res) {
                                if(res.message && res.message.success) {
                                    load_board();
                                } else {
                                    frappe.msgprint(__('Failed to update installation order date.'));
                                }
                            }
                        });
                    });

                    board.append(col);
                });
                header.find('.wi-count').text(total_orders + " orders");
            },
            error: function(xhr) {
                board.html(`<div style="padding:32px 8px;text-align:center;color:#d32f2f">Error loading data. Please contact admin.</div>`);
                header.find('.wi-count').text("");
            }
        });
    }

    // EVENT HANDLERS
    header.find('.wi-refresh-btn').on('click', load_board);
    startDateControl.$input.on('change', load_board);
    technicianControl.$input.on('change', load_board);
    customerControl.$input.on('change', load_board);

    // Initial load
    load_board();
};