import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
  Card,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { AxiosError } from 'axios'
import { usersApi } from '../api/users'
import { useAuth } from '../contexts/AuthContext'
import type { User, UserCreate, UserUpdate, ApiError, Role } from '../types'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography
const { Option } = Select

const roleLabels: Record<Role, string> = {
  admin: '系統管理員',
  engineer: '製程工程師',
  readonly: '唯讀使用者',
}

const roleColors: Record<Role, string> = {
  admin: 'red',
  engineer: 'blue',
  readonly: 'default',
}

interface UserFormValues {
  email: string
  full_name: string
  password?: string
  role: Role
  is_active: boolean
}

function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form] = Form.useForm<UserFormValues>()

  const fetchUsers = useCallback(async (currentPage: number) => {
    setLoading(true)
    try {
      const data = await usersApi.list({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      })
      setUsers(data.items)
      setTotal(data.total)
    } catch {
      message.error('載入使用者列表失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers(page)
  }, [page, fetchUsers])

  const openCreateModal = () => {
    setEditingUser(null)
    form.resetFields()
    form.setFieldsValue({ role: 'readonly', is_active: true })
    setModalOpen(true)
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      password: undefined,
    })
    setModalOpen(true)
  }

  const handleDelete = async (userId: number) => {
    try {
      await usersApi.delete(userId)
      message.success('使用者已刪除')
      fetchUsers(page)
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>
      message.error(axiosError.response?.data?.detail || '刪除失敗')
    }
  }

  const handleSubmit = async () => {
    let values: UserFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    setSubmitting(true)
    try {
      if (editingUser) {
        const updateData: UserUpdate = {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          is_active: values.is_active,
        }
        if (values.password) {
          updateData.password = values.password
        }
        await usersApi.update(editingUser.id, updateData)
        message.success('使用者資料已更新')
      } else {
        const createData: UserCreate = {
          email: values.email,
          full_name: values.full_name,
          password: values.password!,
          role: values.role,
          is_active: values.is_active,
        }
        await usersApi.create(createData)
        message.success('使用者已建立')
      }
      setModalOpen(false)
      fetchUsers(page)
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>
      message.error(axiosError.response?.data?.detail || '操作失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<User> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      render: (name: string) => (
        <Space>
          <UserOutlined />
          {name}
        </Space>
      ),
    },
    {
      title: '電子郵件',
      dataIndex: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: Role) => (
        <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'error'}>{active ? '啟用' : '停用'}</Tag>
      ),
    },
    {
      title: '建立時間',
      dataIndex: 'created_at',
      render: (dt: string) =>
        new Date(dt).toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: User) => (
        <Space>
          <Tooltip title="編輯">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip
            title={record.id === currentUser?.id ? '無法刪除自己' : '刪除'}
          >
            <Popconfirm
              title="確定要刪除此使用者？"
              description="此操作無法復原。"
              onConfirm={() => handleDelete(record.id)}
              okText="確定刪除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={record.id === currentUser?.id}
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
                disabled={record.id === currentUser?.id}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            使用者管理
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            新增使用者
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 筆`,
          showSizeChanger: false,
        }}
      />

      <Modal
        title={editingUser ? '編輯使用者' : '新增使用者'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingUser ? '儲存變更' : '建立使用者'}
        cancelText="取消"
        destroyOnClose
        width={480}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          requiredMark={false}
        >
          <Form.Item
            name="full_name"
            label="姓名"
            rules={[{ required: true, message: '請輸入姓名' }]}
          >
            <Input placeholder="請輸入姓名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="電子郵件"
            rules={[
              { required: true, message: '請輸入電子郵件' },
              { type: 'email', message: '請輸入有效的電子郵件格式' },
            ]}
          >
            <Input placeholder="請輸入電子郵件" />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? '新密碼（選填，留空則不變更）' : '密碼'}
            rules={
              editingUser
                ? []
                : [{ required: true, message: '請輸入密碼' }]
            }
          >
            <Input.Password placeholder={editingUser ? '留空則不變更密碼' : '請輸入密碼'} />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '請選擇角色' }]}
          >
            <Select placeholder="請選擇角色">
              <Option value="admin">系統管理員</Option>
              <Option value="engineer">製程工程師</Option>
              <Option value="readonly">唯讀使用者</Option>
            </Select>
          </Form.Item>

          <Form.Item name="is_active" label="帳號狀態" valuePropName="checked">
            <Switch
              checkedChildren="啟用"
              unCheckedChildren="停用"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default Users
