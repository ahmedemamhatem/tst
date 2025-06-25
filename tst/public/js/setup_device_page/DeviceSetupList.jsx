import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button, Table, Modal, Form, Input, message, Card, Space, Tag } from "antd";
import { SearchOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';

const DeviceSetupList = forwardRef((props, ref) => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [actionType, setActionType] = useState('');
    const [form] = Form.useForm();

    // Expose refresh method to parent
    useImperativeHandle(ref, () => ({
        refresh: fetchDevices
    }));

    // Fetch devices using Frappe's call API
    const fetchDevices = () => {
        setLoading(true);
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Device Setup',
                fields: ['name', 'serial_no', 'item_name', 'customer_name', 'status', 'posting_date', 'username', 'api_key'],
                filters: { docstatus: 0 },
                limit: 100
            },
            callback: (response) => {
                console.log(response)
                setDevices(response.message || []);
                setLoading(false);
            }
        });
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const handleAction = (type, device) => {
        setSelectedDevice(device);
        setActionType(type);
        setIsModalVisible(true);

        if (type === 'check') {
            form.setFieldsValue({
                username: device.username,
                api_key: device.api_key
            });
        } else {
            form.setFieldsValue({
                username: device.username || '',
                password: '',
                api_key: device.api_key || '',
                api_secret: ''
            });
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            if (actionType === 'check') {
                frappe.call({
                    method: 'tst.api.check_user',
                    args: {
                        api_key: values.api_key,
                        username: values.username
                    },
                    callback: (response) => {
                        message.success(response.message);
                        setIsModalVisible(false);
                    }
                });
            } else {
                frappe.call({
                    method: 'tst.api.create_user',
                    args: {
                        api_key: values.api_key,
                        api_secret: values.api_secret,
                        username: values.username,
                        password: values.password
                    },
                    callback: (response) => {
                        message.success(response.message);
                        setIsModalVisible(false);
                    }
                });
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    const filteredData = devices.filter(device =>
        Object.values(device).some(
            val => val?.toString().toLowerCase().includes(searchText.toLowerCase())
        )
    );

    return (
        <Card
            title="Device Setup List"
            extra={
                <Input
                    placeholder="Search devices..."
                    prefix={<SearchOutlined />}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 300 }}
                />
            }
        >
            <Table
                columns={[
                    {
                        title: 'Serial No',
                        dataIndex: 'serial_no',
                        key: 'serial_no',
                    },
                    {
                        title: 'Item',
                        dataIndex: 'item_name',
                        key: 'item_name',
                    },
                    {
                        title: 'Customer',
                        dataIndex: 'customer_name',
                        key: 'customer_name',
                    },
                    {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        render: (status) => (
                            <Tag color={status === 'Active' ? 'green' : 'orange'}>
                                {status}
                            </Tag>
                        ),
                    },
                    {
                        title: 'Actions',
                        key: 'actions',
                        render: (_, record) => (
                            <Space size="middle">
                                <Button
                                    icon={<CheckCircleOutlined />}
                                    onClick={() => handleAction('check', record)}
                                    type="primary"
                                    size="small"
                                >
                                    Check User
                                </Button>
                                <Button
                                    icon={<UserOutlined />}
                                    onClick={() => handleAction('create', record)}
                                    size="small"
                                >
                                    Create User
                                </Button>
                            </Space>
                        ),
                    },
                ]}
                dataSource={filteredData}
                rowKey="name"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />

            <Modal
                title={`${actionType === 'check' ? 'Check' : 'Create'} User for ${selectedDevice?.serial_no}`}
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
                okText={actionType === 'check' ? 'Check' : 'Create'}
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="username"
                        label="Username"
                        rules={[{ required: true, message: 'Please input username!' }]}
                    >
                        <Input />
                    </Form.Item>

                    {actionType === 'create' && (
                        <Form.Item
                            name="password"
                            label="Password"
                            rules={[{ required: true, message: 'Please input password!' }]}
                        >
                            <Input.Password />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="api_key"
                        label="API Key"
                        rules={[{ required: true, message: 'Please input API Key!' }]}
                    >
                        <Input />
                    </Form.Item>

                    {actionType === 'create' && (
                        <Form.Item
                            name="api_secret"
                            label="API Secret"
                            rules={[{ required: true, message: 'Please input API Secret!' }]}
                        >
                            <Input.Password />
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </Card>
    );
});

export { DeviceSetupList };