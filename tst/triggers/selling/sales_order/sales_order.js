frappe.ui.form.on('Sales Order', {
    refresh: function (frm) {
        address_filter(frm)
        if (frm.doc.docstatus == 1) {
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
            frm.add_custom_button(__('Start Training'), () => {
                frappe.call({
                    method: 'tst.triggers.selling.sales_order.sales_order.make_training',
                    args: {
                        sales_order_name: frm.doc.name
                    },
                    callback: function(response) {
                        if(response.message) {
                            // Route to the created Training
                            frappe.set_route('Form', 'Training', response.message);
                        }
                    },
                    freeze: true,
                    freeze_message: __('Creating Training...')
                });
            }).addClass('btn-primary');
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
