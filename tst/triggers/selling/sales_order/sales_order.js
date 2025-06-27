frappe.ui.form.on('Sales Order', {
    onload_post_render: function(frm) {
            cur_frm.remove_custom_button(__('Update Items'));
            cur_frm.remove_custom_button(__('Status'));
            cur_frm.remove_custom_button(__('Pick List'), __('Create'));
            // cur_frm.remove_custom_button(__('Delivery Note'), __('Create'));
            cur_frm.remove_custom_button(__('Work Order'), __('Create'));
            cur_frm.remove_custom_button(__('Request for Raw Materials'), __('Create'));
            cur_frm.remove_custom_button(__('Project'), __('Create'));
            cur_frm.remove_custom_button(__('Payment Request'), __('Create'));
            cur_frm.remove_custom_button(__('Purchase Order'), __('Create'));
            let statusButton = $(`[data-label="${__('Status')}"]`);
            statusButton.hide();
    },
    refresh:  function (frm) {
        cur_frm.remove_custom_button(__('Update Items'));
            cur_frm.remove_custom_button(__('Status'));
            cur_frm.remove_custom_button(__('Pick List'), __('Create'));
            // cur_frm.remove_custom_button(__('Delivery Note'), __('Create'));
            cur_frm.remove_custom_button(__('Work Order'), __('Create'));
            cur_frm.remove_custom_button(__('Request for Raw Materials'), __('Create'));
            cur_frm.remove_custom_button(__('Project'), __('Create'));
            cur_frm.remove_custom_button(__('Payment Request'), __('Create'));
            cur_frm.remove_custom_button(__('Purchase Order'), __('Create'));
            let statusButton = $(`[data-label="${__('Status')}"]`);
            statusButton.hide();
        address_filter(frm)
        if (frm.doc.docstatus == 1 ) {
            frm.add_custom_button(__('Installation Order'), function () {

                // Step 1: Get unique addresses from items
                let address_list = [];
                let parent_address = false;
                (frm.doc.items || []).forEach(item => {
                    if (item.custom_address && !address_list.includes(item.custom_address)) {
                        address_list.push(item.custom_address);
                    }
                });

                // Step 2: Handle based on number of addresses
                if (address_list.length === 0) {
                    address_list.push(frm.doc.customer_address);
                    parent_address = true;

                    // frappe.msgprint(__('No delivery addresses found in the items.'));
                    // return;
                }

                if (address_list.length === 1) {
                    // Only one address, proceed
                    create_installation_order(frm, address_list[0],parent_address);
                } else {
                    // Multiple addresses, show dialog
                    let dialog = new frappe.ui.Dialog({
                        title: 'Select Delivery Address',
                        fields: [
                            {
                                fieldname: 'selected_address',
                                label: 'Delivery Address',
                                fieldtype: 'Select',
                                options: address_list,
                                reqd: 1
                            }
                        ],
                        primary_action_label: 'Create Installation Order',
                        primary_action(values) {
                            dialog.hide();
                            create_installation_order(frm, values.selected_address,parent_address);
                        }
                    });
                    dialog.show();
                }

            });
            frappe.call({
            method: 'frappe.client.get_value',
            args: {
                doctype: 'Device Setup',
                filters: { sales_order: frm.doc.name },
                fieldname: 'name'
            },
            callback: function(r) {
                
                if (!r.exc && r.message && r.message.name) {
                    // Prevent duplicate button
                    if (!frm.custom_buttons || !frm.custom_buttons['Start Training']) {
                        frm.add_custom_button(__('Start Training'), () => {
                            frappe.call({
                                method: 'tst.triggers.selling.sales_order.sales_order.make_training',
                                args: {
                                    sales_order_name: frm.doc.name
                                },
                                callback: function(response) {
                                    if (response.message) {
                                        frappe.set_route('Form', 'Training');
                                    }
                                },
                                freeze: true,
                                freeze_message: __('Creating Training...')
                            });
                        }).addClass('btn-primary');
                    }
                }
            }
        });
    }
    }
});

function address_filter(frm) {
    if (frm.doc.customer){
        frappe.call({
            method: 'tst.triggers.selling.sales_order.sales_order.get_customer_address_and_contacts_list',
            args: {
                customer: frm.doc.customer
            },
            callback: function(response) {
                // console.log(response.message)
                const address_list = response.message[0] || [];
                const contact_list = response.message[1] || [];

                frm.fields_dict['items'].grid.get_field("custom_address").get_query = function(doc, cdt, cdn) {
                    return {
                        filters: [
                            ["Address", "name", "in", address_list]
                        ]
                    };
                };
                frm.fields_dict['items'].grid.get_field("custom_contact").get_query = function(doc, cdt, cdn) {
                    return {
                        filters: [
                            ["Contact", "name", "in", contact_list]
                        ]
                    };
                };
                
            }
        });
    }
}

// Function to call your Python method with selected address
function create_installation_order(frm, address,parent_address) {
    frappe.model.open_mapped_doc({
        method: 'tst.triggers.selling.sales_order.sales_order.make_installation_order',
        frm: frm,
        args: {
            address: address , // Pass the selected address to server-side method
            parent_address:parent_address
        }
    });
}


// frappe.ui.form.on("Sales Order Item",{
//     custom_address:function(frm){
//         console.log("testststss")
//         if (frm.doc.customer){
//             address_filter(frm)
//         }
//     },
    
// })
