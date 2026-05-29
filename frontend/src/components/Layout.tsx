import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Typography,
  Space,
  theme,
} from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  ControlOutlined,
  BarChartOutlined,
  ToolOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

const roleLabels: Record<string, string> = {
  admin: '系統管理員',
  engineer: '製程工程師',
  readonly: '唯讀使用者',
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '儀表板',
    },
    {
      key: '/sop',
      icon: <FileTextOutlined />,
      label: 'SOP知識庫',
    },
    {
      key: '/process-params',
      icon: <ControlOutlined />,
      label: '製程參數',
      disabled: true,
    },
    {
      key: '/yield-analysis',
      icon: <BarChartOutlined />,
      label: '良率分析',
      disabled: true,
    },
    {
      key: '/equipment',
      icon: <ToolOutlined />,
      label: '設備記錄',
      disabled: true,
    },
    ...(user?.role === 'admin'
      ? [
          {
            type: 'divider' as const,
          },
          {
            key: '/users',
            icon: <TeamOutlined />,
            label: '使用者管理',
          },
        ]
      : []),
  ]

  const userMenuItems = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: '個人設定',
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '登出',
      danger: true,
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout()
      navigate('/login')
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#001529',
        }}
      >
        {/* Logo / Brand */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0' : '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {collapsed ? (
            <Text style={{ color: '#1890ff', fontSize: 20, fontWeight: 'bold' }}>F</Text>
          ) : (
            <Title level={5} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
              FAB System
            </Title>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 16px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 40, height: 40 }}
          />

          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: handleUserMenuClick,
            }}
            placement="bottomRight"
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                icon={<UserOutlined />}
                style={{ backgroundColor: '#1890ff' }}
              />
              {!collapsed && (
                <Space direction="vertical" size={0}>
                  <Text strong style={{ fontSize: 14 }}>
                    {user?.full_name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {user?.role ? roleLabels[user.role] : ''}
                  </Text>
                </Space>
              )}
            </Space>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 'calc(100vh - 64px - 48px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
