import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Space,
} from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { AxiosError } from 'axios'
import { useAuth } from '../contexts/AuthContext'
import type { LoginRequest, ApiError } from '../types'

const { Title, Text } = Typography

function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading } = useAuth()
  const [form] = Form.useForm()

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const onFinish = async (values: LoginRequest) => {
    try {
      await login(values)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>
      const errorMsg =
        axiosError.response?.data?.detail || '登入失敗，請檢查您的帳號和密碼'
      form.setFields([
        {
          name: 'password',
          errors: [errorMsg],
        },
      ])
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #001529 0%, #003a6c 100%)',
      }}
    >
      <Card
        style={{
          width: 420,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ marginBottom: 4, color: '#001529' }}>
              FAB System
            </Title>
            <Text type="secondary">半導體製程工程師管理系統</Text>
          </div>

          {/* Demo credentials notice */}
          <Alert
            message="預設管理員帳號"
            description={
              <span>
                帳號：<strong>admin@fab.local</strong>
                <br />
                密碼：<strong>Admin1234!</strong>
              </span>
            }
            type="info"
            showIcon
          />

          {/* Login Form */}
          <Form
            form={form}
            name="login"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="on"
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label="電子郵件"
              rules={[
                { required: true, message: '請輸入電子郵件' },
                { type: 'email', message: '請輸入有效的電子郵件格式' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="請輸入電子郵件"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密碼"
              rules={[{ required: true, message: '請輸入密碼' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="請輸入密碼"
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                style={{ marginTop: 8 }}
              >
                登入
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default Login
