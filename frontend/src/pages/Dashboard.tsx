import { Card, Row, Col, Statistic, Typography, Space, Tag } from 'antd'
import {
  FileTextOutlined,
  ControlOutlined,
  BarChartOutlined,
  ToolOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Title, Text, Paragraph } = Typography

const roleLabels: Record<string, string> = {
  admin: '系統管理員',
  engineer: '製程工程師',
  readonly: '唯讀使用者',
}

const roleColors: Record<string, string> = {
  admin: 'red',
  engineer: 'blue',
  readonly: 'default',
}

const moduleCards = [
  {
    title: 'SOP知識庫',
    icon: <FileTextOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
    description: '管理標準作業程序文件，支援版本控制與搜尋功能',
    status: '即將推出',
    color: '#e6f7ff',
  },
  {
    title: '製程參數',
    icon: <ControlOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
    description: '記錄與追蹤製程參數設定，支援歷史趨勢分析',
    status: '即將推出',
    color: '#f6ffed',
  },
  {
    title: '良率分析',
    icon: <BarChartOutlined style={{ fontSize: 32, color: '#fa8c16' }} />,
    description: '晶圓良率統計分析，識別製程異常與改善機會',
    status: '即將推出',
    color: '#fff7e6',
  },
  {
    title: '設備記錄',
    icon: <ToolOutlined style={{ fontSize: 32, color: '#eb2f96' }} />,
    description: '設備維護記錄管理，追蹤設備狀態與保養排程',
    status: '即將推出',
    color: '#fff0f6',
  },
]

function Dashboard() {
  const { user } = useAuth()

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? '早安' : now.getHours() < 18 ? '午安' : '晚安'

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Welcome Section */}
      <Card>
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={4} style={{ marginBottom: 4 }}>
              {greeting}，{user?.full_name} 👋
            </Title>
            <Space>
              <Text type="secondary">歡迎使用 FAB System</Text>
              {user?.role && (
                <Tag color={roleColors[user.role]}>{roleLabels[user.role]}</Tag>
              )}
            </Space>
          </Col>
          <Col>
            <Statistic
              title={
                <Space>
                  <ClockCircleOutlined />
                  <span>系統時間</span>
                </Space>
              }
              value={now.toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Stats Overview */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SOP文件數量"
              value={0}
              suffix="件"
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="製程參數記錄"
              value={0}
              suffix="筆"
              valueStyle={{ color: '#52c41a' }}
              prefix={<ControlOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="本月良率分析"
              value={0}
              suffix="件"
              valueStyle={{ color: '#fa8c16' }}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="設備記錄"
              value={0}
              suffix="筆"
              valueStyle={{ color: '#eb2f96' }}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Module Cards */}
      <Title level={5} style={{ marginBottom: 0 }}>
        功能模組
      </Title>
      <Row gutter={[16, 16]}>
        {moduleCards.map((mod) => (
          <Col xs={24} sm={12} lg={6} key={mod.title}>
            <Card
              hoverable
              style={{
                background: mod.color,
                border: 'none',
                height: '100%',
              }}
            >
              <Space direction="vertical" size="small">
                {mod.icon}
                <Title level={5} style={{ marginBottom: 0 }}>
                  {mod.title}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 13 }}>
                  {mod.description}
                </Paragraph>
                <Tag>{mod.status}</Tag>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Phase Info */}
      <Card size="small" style={{ background: '#f9f9f9' }}>
        <Text type="secondary">
          目前版本：Phase 1 (v1.0.0) ─ 基礎架構、身份驗證與使用者管理。後續功能模組將於 Phase 2–5 陸續推出。
        </Text>
      </Card>
    </Space>
  )
}

export default Dashboard
