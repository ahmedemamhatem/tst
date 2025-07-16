import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
    Button,
    Table,
    Modal,
    Form,
    Input,
    message,
    Card,
    Space,
    Tag,
    Select,
    List,
    Descriptions,
    DatePicker,
    Collapse,
    Typography,
    Divider,
    Alert,
    Dropdown,
    Badge
} from "antd";
import {
    SearchOutlined,
    UserOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    InfoCircleOutlined,
    SyncOutlined,
    FilterOutlined,
    EditOutlined,
    MoreOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { Panel } = Collapse;

const statusOptions = [
    { value: 'all', label: __('All') },
    { value: 'Pending', label: __('Pending') },
    { value: 'Done Installation Ready for Server Setup', label: __('Done Installation') },
    { value: 'Active', label: __('Active') },
    { value: 'Inactive', label: __('Inactive') },
    { value: 'Broken', label: __('Broken') },
    { value: 'Archived', label: __('Archived') },
    { value: 'Suspended', label: __('Suspended') }
];

const statusTagColors = {
    'Pending': 'orange',
    'Done Installation Ready for Server Setup': 'blue',
    'Active': 'green',
    'Inactive': 'red',
    'Broken': 'volcano',
    'Archived': 'gray',
    'Suspended': 'purple'
};

const statusIcons = {
    'Pending': <InfoCircleOutlined />,
    'Done Installation Ready for Server Setup': <CheckCircleOutlined />,
    'Active': <CheckCircleOutlined />,
    'Inactive': <CloseCircleOutlined />,
    'Broken': <CloseCircleOutlined />,
    'Archived': <CloseCircleOutlined />,
    'Suspended': <InfoCircleOutlined />
};

const DeviceSetupList = forwardRef((props, ref) => {
    const [devices, setDevices] = useState([]);
    const [filteredDevices, setFilteredDevices] = useState([]);
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [serverLoading, setServerLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isDeviceModalVisible, setIsDeviceModalVisible] = useState(false);
    const [isResponseModalVisible, setIsResponseModalVisible] = useState(false);
    const [actionType, setActionType] = useState('');
    const [form] = Form.useForm();
    const [deviceForm] = Form.useForm();
    const [userResults, setUserResults] = useState(null);
    const [checkLoading, setCheckLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState(null);
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [editMode, setEditMode] = useState(false);

    // Fetch servers and devices
    const fetchServers = () => {
        setServerLoading(true);
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Site',
                fields: ['name', 'server', 'domain', 'port'],
                limit: 100,
                order_by: 'creation desc'
            },
            callback: (response) => {
                setServers(response.message || []);
                setServerLoading(false);
            }
        });
    };

    const fetchDevices = () => {
        setLoading(true);
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Device Setup',
                fields: [
                    'name', 'serial_no', 'item_name', 'customer_name', 'status', 'customer_id',
                    'posting_date', 'username', 'customer', 'response',
                    'vehicle_name', 'vehicle_type', 'iccid', 'device_type',
                    'create_date', 'odometer', 'user_type', 'user_id', 'userlogin', "docstatus"
                ],
                limit: 100,
                order_by: 'creation desc'
            },
            callback: (response) => {
                setDevices(response.message || []);
                setLoading(false);
                applyFilters(response.message || [], searchText, statusFilter);
            }
        });
    };

    const handleAction = (type, device) => {
        setSelectedDevice(device);
        setActionType(type);
        setApiResponse(null);

        // Check if device has required fields filled
        if (!device.serial_no || !device.vehicle_name || !device.vehicle_type ||
            !device.iccid || !device.device_type || !device.create_date) {
            setIsDeviceModalVisible(true);
            deviceForm.setFieldsValue({
                serial_no: device.serial_no,
                vehicle_name: device.vehicle_name,
                vehicle_type: device.vehicle_type,
                iccid: device.iccid,
                device_type: device.device_type,
                create_date: device.create_date,
                odometer: device.odometer
            });
            return;
        }

        setIsModalVisible(true);
        setUserResults(null);

        if (type === 'check') {
            form.setFieldsValue({
                customerID: device.customer_id,
                customerName: device.customer_name,
                userType: device.user_type || '2' // Default to End User
            });
        } else {
            form.setFieldsValue({
                username: device.username || '',
                password: '',
                api_secret: '',
                userType: device.user_type || '2',
                server: device.site || ''
            });
        }
    };

    useEffect(() => {
        fetchDevices();
        fetchServers();
    }, []);

    useImperativeHandle(ref, () => ({
        refresh: fetchDevices
    }));

    // Filtering logic
    const applyFilters = (devicesToFilter = devices, search = searchText, status = statusFilter) => {
        let result = [...devicesToFilter];

        // Apply status filter
        if (status !== 'all') {
            result = result.filter(device => device.status === status);
        }

        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(device =>
                Object.entries(device).some(([key, value]) => {
                    // Skip certain fields from search if needed
                    if (['response'].includes(key)) return false;
                    return value?.toString().toLowerCase().includes(searchLower);
                })
            );
        }

        setFilteredDevices(result);
    };

    useEffect(() => {
        applyFilters();
    }, [searchText, statusFilter]);

    const handleStatusFilterChange = (value) => {
        setStatusFilter(value);
    };

    // Device edit functionality
    const handleEditDevice = (device) => {
        setSelectedDevice(device);
        setEditMode(true);
        setIsDeviceModalVisible(true);
        deviceForm.setFieldsValue({
            serial_no: device.serial_no,
            vehicle_name: device.vehicle_name,
            vehicle_type: device.vehicle_type,
            iccid: device.iccid,
            device_type: device.device_type,
            create_date: device.create_date ? moment(device.create_date) : null,
            odometer: device.odometer
        });
    };

    const saveDeviceData = () => {
        deviceForm.validateFields()
            .then(values => {
                if (values.create_date) {
                    values.create_date = values.create_date.format('YYYY-MM-DD');
                }

                frappe.call({
                    method: editMode ? 'frappe.client.set_value' : 'frappe.client.set_value',
                    args: editMode ? {
                        doctype: 'Device Setup',
                        name: selectedDevice.name,
                        fieldname: {
                            serial_no: values.serial_no,
                            vehicle_name: values.vehicle_name,
                            vehicle_type: values.vehicle_type,
                            iccid: values.iccid,
                            device_type: values.device_type,
                            create_date: values.create_date,
                            odometer: values.odometer
                        }
                    } : {
                        // For new device creation (if needed)
                    },
                    callback: (response) => {
                        message.success(`Device data ${editMode ? 'updated' : 'saved'} successfully`);
                        fetchDevices();
                        setIsDeviceModalVisible(false);
                        setEditMode(false);
                        if (!editMode) {
                            setIsModalVisible(true);
                        }
                    }
                });
            })
            .catch(error => {
                message.error("Please fill all required fields");
            });
    };

    const handleCheckUser = async () => {
        try {
            const values = await form.validateFields(['customerID', 'userType']);
            console.log('Checking user with values:', values);
            setCheckLoading(true);

            frappe.call({
                method: 'tst.api.check_user',
                args: {
                    customerID: values.customerID
                },
                callback: (response) => {
                    setCheckLoading(false);
                    if (response.message && response.message.status === "success") {
                        setUserResults(response.message);
                        setApiResponse({
                            status: 'success',
                            message: 'User check completed successfully',
                            data: response.message
                        });
                    } else {
                        setApiResponse({
                            status: 'error',
                            message: response.message?.error || "Failed to check user",
                            data: response.message
                        });
                        message.error(response.message?.error || "Failed to check user");
                    }
                },
                error: (err) => {
                    setCheckLoading(false);
                    setApiResponse({
                        status: 'error',
                        message: err.message || "Failed to check user",
                        data: null
                    });
                    message.error(err.message || "Failed to check user");
                }
            });
        } catch (error) {
            setCheckLoading(false);
            message.error(error.message || "Validation failed");
        }
    };

    const handleUseExistingUser = (user) => {
        const userType = form.getFieldValue('userType');
        if (!userType) {
            message.error("Please select a user type before using an existing user.");
            return;
        }

        frappe.call({
            method: 'tst.api.add_device',
            args: {
                DeviceSetupId: selectedDevice.name,
                CustomerID: user.CustomerID,
                UserID: user.UserID,
                UserName: user.UserName,
                UserType: userType,
                LoginNAME: user.LoginName,
                Password: user.Password,
                ServerIP: user.server
            },
            callback: (response) => {
                if (response.message && response.message.status === "success") {
                    setApiResponse({
                        status: 'success',
                        message: 'Device successfully added to user',
                        data: response.message
                    });
                    message.success("Device successfully added to user");
                    fetchDevices();
                    setIsModalVisible(false);
                    setIsResponseModalVisible(true);
                } else {

                    setApiResponse({
                        status: 'error',
                        message: response.message?.error || "Failed to add device to user",
                        data: response.message
                    });
                    message.error(response.message?.error || "Failed to add device to user");
                    setIsResponseModalVisible(true);
                }
            }
        });
    };

    const handleCreateNewUser = () => {
        setActionType('create');
        setUserResults(null);
        form.setFieldsValue({
            username: '',
            password: '',
            api_secret: ''
        });
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            if (actionType === 'create') {
                frappe.call({
                    method: 'tst.api.create_user',
                    args: {
                        Username: values.username,
                        CustomerID: values.customerID,
                        DeviceSetupId: selectedDevice.name,
                        UserLogin: values.username,
                        Password: values.password,
                        UserType: values.userType,
                        ServerIP: values.server,
                    },
                    callback: (response) => {
                        if (response.message) {
                            if (response.message.userID) {
                                // Success case
                                setApiResponse({
                                    status: 'success',
                                    message: 'User created successfully',
                                    data: response.message
                                });

                                // Add device to the newly created user
                                frappe.call({
                                    method: 'tst.api.add_device',
                                    args: {
                                        DeviceSetupId: selectedDevice.name,
                                        CustomerID: values.customerID,
                                        UserID: response.message.userID,
                                        UserName: values.username,
                                        UserType: values.userType,
                                        LoginNAME: values.username,
                                        Password: values.password,
                                        ServerIP: values.server
                                    },
                                    callback: (addDeviceResponse) => {
                                        console.log('Add Device Response:', addDeviceResponse);
                                        if (addDeviceResponse.message && addDeviceResponse.message.status === "success") {
                                            setApiResponse(prev => ({
                                                ...prev,
                                                message: 'User created and device added successfully',
                                                addDeviceData: addDeviceResponse.message
                                            }));
                                            message.success("User created and device added successfully");
                                            fetchDevices();
                                            setIsModalVisible(false);
                                            setIsResponseModalVisible(true);
                                        } else {
                                            setApiResponse(prev => ({
                                                ...prev,
                                                status: 'partial',
                                                message: 'User created but failed to add device',
                                                addDeviceData: addDeviceResponse.message
                                            }));
                                            message.error(addDeviceResponse.message?.error || "User created but failed to add device");
                                            setIsResponseModalVisible(true);
                                        }
                                    }
                                });
                            } else {
                                setApiResponse({
                                    status: 'error',
                                    message: response.message.error || "Failed to create user",
                                    data: response.message
                                });
                                message.error(response.message.error || "Failed to create user");
                                setIsResponseModalVisible(true);
                            }
                        }
                    }
                });
            }
        } catch (error) {
            message.error(error.message || "Failed to create user");
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setUserResults(null);
        setApiResponse(null);
    };



    const handleResponseModalClose = () => {
        setIsResponseModalVisible(false);
        setApiResponse(null);
    };


    const expandRow = (expanded, record) => {
        const keys = expanded ? [record.name] : [];
        setExpandedRowKeys(keys);
    };

    const expandedRowRender = (record) => {
        let parsedResponse = null;
        let parseError = null;

        try {
            if (record.response) {
                // First, fix the string by replacing single quotes with double quotes
                const fixedJsonString = record.response.replace(/'/g, '"');
                parsedResponse = JSON.parse(fixedJsonString);
            }
        } catch (error) {
            parseError = error.message;
            console.error('Failed to parse response:', error);
        }

        return (
            <div style={{ margin: 0 }}>
                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label={__("Serial Number")}>{record.serial_no || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("Vehicle Name")}>{record.vehicle_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("Vehicle Type")}>{record.vehicle_type || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("ICCID")}>{record.iccid || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("Device Type")}>{record.device_type || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("Create Date")}>{record.create_date || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("Odometer")}>{record.odometer || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("User Type")}>
                        {record.user_type === "1" ? __("Distributor") :
                            record.user_type === "2" ? __("End User") : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={__("User ID")}>{record.user_id || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("Username")}>{record.username || '-'}</Descriptions.Item>
                    <Descriptions.Item label={__("Login Name")}>{record.userlogin || '-'}</Descriptions.Item>
                </Descriptions>

                {record.response && (
                    <>
                        <Divider orientation="left" style={{ marginTop: 20 }}>API Response</Divider>
                        {parseError ? (
                            <Alert
                                message="Error parsing response"
                                description={parseError}
                                type="error"
                                showIcon
                            />
                        ) : (
                            <pre style={{
                                background: '#f5f5f5',
                                padding: 10,
                                borderRadius: 4,
                                maxHeight: 200,
                                overflow: 'auto'
                            }}>
                                {JSON.stringify(parsedResponse, null, 2)}
                            </pre>
                        )}
                    </>
                )}
            </div>
        );
    };
    return (
        <Card
            title={__("Device Setup Management")}
            extra={
                <Space>
                    <Input
                        placeholder={__("Search devices...")}
                        prefix={<SearchOutlined />}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                        allowClear
                    />
                    <Select
                        style={{ width: 200 }}
                        placeholder={__("Filter by status")}
                        value={statusFilter}
                        onChange={handleStatusFilterChange}
                        options={statusOptions}
                        allowClear
                        onClear={() => setStatusFilter('all')}
                    />
                    <Button
                        icon={<SyncOutlined />}
                        onClick={fetchDevices}
                        loading={loading}
                    >
                        {__("Refresh")}
                    </Button>
                </Space>
            }
        >
            <Table
                columns={[
                    {
                        title: __('Serial No'),
                        dataIndex: 'serial_no',
                        key: 'serial_no',
                        render: (text) => text || <Text type="warning">Not Set</Text>,
                        sorter: (a, b) => (a.serial_no || '').localeCompare(b.serial_no || '')
                    },
                    {
                        title: __('Item'),
                        dataIndex: 'item_name',
                        key: 'item_name',
                        sorter: (a, b) => (a.item_name || '').localeCompare(b.item_name || '')
                    },
                    {
                        title: __('Customer'),
                        key: 'customer',
                        render: (_, record) => (
                            <div>
                                <div><strong>{record.customer}</strong></div>
                                <div style={{ fontSize: 12 }}>{record.customer_name}</div>
                            </div>
                        ),
                        sorter: (a, b) => (a.customer || '').localeCompare(b.customer || '')
                    },
                    {
                        title: __('Status'),
                        dataIndex: 'status',
                        key: 'status',
                        render: (status) => (
                            <Tag
                                color={statusTagColors[status] || 'default'}
                                icon={statusIcons[status]}
                            >
                                {status === 'Done Installation Ready for Server Setup' ?
                                    'Done Installation' : status}
                            </Tag>
                        ),
                        filters: statusOptions.filter(opt => opt.value !== 'all').map(opt => ({
                            text: opt.label,
                            value: opt.value
                        })),
                        onFilter: (value, record) => record.status === value,
                        sorter: (a, b) => (a.status || '').localeCompare(b.status || '')
                    },
                    {
                        title: __('Date'),
                        dataIndex: 'posting_date',
                        key: 'posting_date',
                        render: (date) => date ? new Date(date).toLocaleDateString() : '-',
                        sorter: (a, b) => new Date(a.posting_date) - new Date(b.posting_date)
                    },
                    {
                        title: 'Actions',
                        key: 'actions',
                        render: (_, record) => (

                            <Space size="middle">
                                {record.docstatus === 0 ? (
                                    <Dropdown
                                        menu={{
                                            items: [
                                                {
                                                    key: 'edit',
                                                    label: __('Edit Device'),
                                                    icon: <EditOutlined />,
                                                    onClick: () => handleEditDevice(record)
                                                },
                                                {
                                                    key: 'check',
                                                    label: __('Check User'),
                                                    icon: <CheckCircleOutlined />,
                                                    onClick: () => handleAction('check', record),
                                                    disabled: !record.customer
                                                },
                                                {
                                                    key: 'create',
                                                    label: __('Create User'),
                                                    icon: <UserOutlined />,
                                                    onClick: () => handleAction('create', record),
                                                    disabled: !record.customer
                                                }
                                            ]
                                        }}
                                    >
                                        <Button icon={<MoreOutlined />} />
                                    </Dropdown>
                                )
                                    : (
                                        <Button
                                            type="primary"
                                            disabled
                                            icon={<EditOutlined />}
                                            title={__('This device is already processed')}
                                            danger
                                            ghost
                                            style={{ backgroundColor: '#ccc', borderColor: '#ccc' }}
                                        />
                                    )}

                            </Space>
                        ),
                    },
                ]}
                dataSource={filteredDevices}
                rowKey="name"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                expandable={{
                    expandedRowRender,
                    expandedRowKeys,
                    onExpand: expandRow,
                    rowExpandable: record => true
                }}
                scroll={{ x: 'max-content' }}
            />

            {/* Device Data Modal */}
            <Modal
                title={`${editMode ? __('Edit') : __('Complete')} Device Data for ${selectedDevice?.serial_no || __('New Device')}`}
                open={isDeviceModalVisible}
                onOk={saveDeviceData}
                onCancel={() => {
                    setIsDeviceModalVisible(false);
                    setEditMode(false);
                }}
                okText={editMode ? __('Update') : __('Save')}
                width={700}
            >
                <Form form={deviceForm} layout="vertical">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item
                            name="serial_no"
                            label={__('Serial Number')}
                            rules={[{ required: true, message: __('Please input serial number!') }]}
                        >
                            <Input disabled={editMode} />
                        </Form.Item>
                        <Form.Item
                            name="vehicle_name"
                            label={__('Vehicle Name')}
                            rules={[{ required: true, message: __('Please input vehicle name!') }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="vehicle_type"
                            label={__('Vehicle Type')}
                            rules={[{ required: true, message: __('Please input vehicle type!') }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="iccid"
                            label={__('ICCID')}
                            rules={[{ required: true, message: __('Please input ICCID!') }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="device_type"
                            label={__('Device Type')}
                            rules={[{ required: true, message: __('Please input device type!') }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="create_date"
                            label={__('Create Date')}
                            rules={[{ required: true, message: __('Please select create date!') }]}
                        >
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            name="odometer"
                            label={__('Odometer')}
                        >
                            <Input type="number" />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* User Modal */}
            <Modal
                title={`${actionType === 'check' ? __('Check') : __('Create')} User for Device: ${selectedDevice?.serial_no || ''}`}
                open={isModalVisible}
                onOk={actionType === 'check' ? (userResults ? handleCreateNewUser : handleCheckUser) : handleOk}
                onCancel={handleCancel}
                okText={actionType === 'check' ?
                    (userResults ? __('Create New User') : __('Check User')) :
                    __('Create User')}
                width={userResults ? 800 : 520}
                confirmLoading={checkLoading}
                footer={[
                    <Button key="back" onClick={handleCancel}>
                        {__('Cancel')}
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={checkLoading}
                        onClick={actionType === 'check' ?
                            (userResults ? handleCreateNewUser : handleCheckUser) :
                            handleOk}
                    >
                        {actionType === 'check' ?
                            (userResults ? __('Create New User') : __('Check User')) :
                            __('Create User')}
                    </Button>
                ]}
            >
                <Form form={form} layout="vertical">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item
                            name="customerID"
                            label={__('Customer ID')}
                            initialValue={selectedDevice?.customer_id || ''}
                            rules={[{ required: true, message: __('Please input customer ID!') }]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item
                            name="customerName"
                            initialValue={selectedDevice?.customer_name || ''}
                            label={__('Customer Name')}
                        >
                            <Input disabled />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="userType"
                        label={__('User Type')}
                        rules={[{ required: true, message: __('Please select a user type!') }]}
                    >
                        <Select placeholder={__('Select User Type')}>
                            <Select.Option value="1">{__('Distributor')}</Select.Option>
                            <Select.Option value="2">{__('End User')}</Select.Option>
                        </Select>
                    </Form.Item>

                    {actionType === 'check' && userResults && (
                        <div style={{ marginTop: 20 }}>
                            <Alert
                                message={__('Existing Users Found')}
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <List
                                itemLayout="horizontal"
                                dataSource={userResults.user_server}
                                renderItem={(user) => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                type="primary"
                                                onClick={() => handleUseExistingUser(user)}
                                            >
                                                {__('Use This User')}
                                            </Button>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={<>
                                                <Tag color="blue">{user.server}</Tag>
                                                {user.UserName}
                                            </>}
                                            description={
                                                <Descriptions column={2} size="small">
                                                    <Descriptions.Item label={__('User ID')}>{user.UserID}</Descriptions.Item>
                                                    <Descriptions.Item label={__('Login')}>{user.LoginName}</Descriptions.Item>
                                                    <Descriptions.Item label={__('Type')}>
                                                        {user.UserType === "1" ? __('Distributor') : __('End User')}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label={__('Password')}>{user.Password}</Descriptions.Item>
                                                </Descriptions>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </div>
                    )}

                    {actionType === 'create' && (
                        <>
                            <Form.Item
                                name="username"
                                label={__('Username')}
                                rules={[{ required: true, message: __('Please input username!') }]}
                            >
                                <Input />
                            </Form.Item>
                            <Form.Item
                                name="password"
                                label={__('Password')}
                                rules={[{ required: true, message: __('Please input password!') }]}
                            >
                                <Input.Password />
                            </Form.Item>
                            <Form.Item
                                name="server"
                                label={__('Select Server')}
                                rules={[{ required: true, message: __('Please select a server!') }]}
                            >
                                <Select
                                    loading={serverLoading}
                                    placeholder={__('Select a server')}
                                    optionFilterProp="children"
                                    showSearch
                                >
                                    {servers.map(server => (
                                        <Select.Option
                                            key={server.name}
                                            value={server.server}
                                        >
                                            {server.server} ({server.domain}:{server.port})
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </>
                    )}
                </Form>
            </Modal>

            {/* Response Modal */}
            <Modal
                title={`API Response for ${selectedDevice?.serial_no || 'Device'}`}
                open={isResponseModalVisible}
                onCancel={handleResponseModalClose}
                footer={[
                    <Button key="close" type="primary" onClick={handleResponseModalClose}>
                        {__('Close')}
                    </Button>
                ]}
                width={800}
            >
                {apiResponse && (
                    <div>
                        <Alert
                            message={apiResponse.message}
                            type={apiResponse.status === 'success' ? 'success' :
                                apiResponse.status === 'partial' ? 'warning' : 'error'}
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Collapse defaultActiveKey={['1']}>
                            <Panel header="Response Details" key="1">
                                <pre style={{
                                    background: '#f5f5f5',
                                    padding: 10,
                                    borderRadius: 4,
                                    maxHeight: 300,
                                    overflow: 'auto'
                                }}>
                                    {JSON.stringify(apiResponse.data, null, 2)}
                                </pre>
                            </Panel>
                            {apiResponse.addDeviceData && (
                                <Panel header="Add Device Response" key="2">
                                    <pre style={{
                                        background: '#f5f5f5',
                                        padding: 10,
                                        borderRadius: 4,
                                        maxHeight: 300,
                                        overflow: 'auto'
                                    }}>
                                        {JSON.stringify(apiResponse.addDeviceData, null, 2)}
                                    </pre>
                                </Panel>
                            )}
                        </Collapse>
                    </div>
                )}
            </Modal>
        </Card>
    );
});

export { DeviceSetupList };