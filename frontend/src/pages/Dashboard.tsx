import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Tag,
  Table,
  Skeleton,
  Empty,
  Select,
  Badge,
  Divider,
  Tooltip,
} from 'antd'
import {
  FileTextOutlined,
  ControlOutlined,
  BarChartOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  AlertOutlined,
  RiseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import {
  getDashboardSummary,
  getRecentAlarms,
  getRecentYield,
  getOverduePms,
  getYieldTrend7d,
} from '../api/dashboard'
import { getYieldProducts, getYieldSteps } from '../api/yield'
import type {
  DashboardSummary,
  RecentAlarm,
  RecentYieldRecord,
  OverduePm,
  YieldTrendDay,
  YieldProduct,
  YieldStep,
} from '../types'

const { Title, Text } = Typography
const { Option } = Select

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(hour: number): string {
  if (hour < 12) return '早安'
  if (hour < 18) return '午安'
  return '晚安'
}

function formatDateChinese(d: Date): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日（週${weekdays[d.getDay()]}）`
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '剛才'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function formatMMDD(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${month}/${day}`
}

const severityConfig: Record<string, { color: string; label: string }> = {
  low: { color: '#52c41a', label: '低' },
  medium: { color: '#faad14', label: '中' },
  high: { color: '#fa8c16', label: '高' },
  critical: { color: '#f5222d', label: '緊急' },
}

function yieldColor(pct: number): string {
  if (pct >= 95) return '#52c41a'
  if (pct >= 90) return '#faad14'
  return '#f5222d'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Stat card with large number
interface StatCardProps {
  title: string
  value: number | string
  precision?: number
  suffix?: string
  subtitle: string
  valueColor: string
  icon: React.ReactNode
  loading: boolean
}

function StatCard({ title, value, precision, suffix, subtitle, valueColor, icon, loading }: StatCardProps) {
  return (
    <Card
      style={{ height: '100%', borderRadius: 10 }}
      bodyStyle={{ padding: '20px 24px' }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (
        <>
          <Space style={{ marginBottom: 4 }}>
            {icon}
            <Text type="secondary" style={{ fontSize: 14 }}>{title}</Text>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Statistic
              value={value}
              precision={precision}
              suffix={suffix}
              valueStyle={{ color: valueColor, fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
            {subtitle}
          </Text>
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Yield Trend Chart
// ---------------------------------------------------------------------------

interface YieldTrendChartProps {
  data: YieldTrendDay[]
  loading: boolean
  products: YieldProduct[]
  steps: YieldStep[]
  selectedProductId: string
  selectedStepId: string
  onProductChange: (v: string) => void
  onStepChange: (v: string) => void
}

function YieldTrendChart({
  data,
  loading,
  products,
  steps,
  selectedProductId,
  selectedStepId,
  onProductChange,
  onStepChange,
}: YieldTrendChartProps) {
  const chartData = data.map((d) => ({
    date: formatMMDD(d.date),
    avg_yield: d.avg_yield,
  }))

  return (
    <Card
      title={
        <Space>
          <BarChartOutlined style={{ color: '#1890ff' }} />
          <span>近 7 天良率趨勢</span>
        </Space>
      }
      extra={
        <Space size="small" wrap>
          <Select
            size="small"
            style={{ width: 120 }}
            placeholder="選擇產品"
            allowClear
            value={selectedProductId || undefined}
            onChange={(v) => onProductChange(v ?? '')}
          >
            {products.map((p) => (
              <Option key={p.id} value={p.id}>{p.name}</Option>
            ))}
          </Select>
          <Select
            size="small"
            style={{ width: 100 }}
            placeholder="選擇站點"
            allowClear
            value={selectedStepId || undefined}
            onChange={(v) => onStepChange(v ?? '')}
          >
            {steps.map((s) => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>
        </Space>
      }
      style={{ height: '100%', borderRadius: 10 }}
      bodyStyle={{ paddingTop: 8 }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1890ff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" width={40} />
            <RechartsTooltip
              formatter={(val: number | null) => val != null ? [`${val.toFixed(2)}%`, '平均良率'] : ['無資料', '平均良率']}
              labelFormatter={(label) => `日期：${label}`}
            />
            <ReferenceLine
              y={95}
              stroke="#52c41a"
              strokeDasharray="6 3"
              label={{ value: '目標 95%', position: 'right', fontSize: 11, fill: '#52c41a' }}
            />
            <Area
              type="monotone"
              dataKey="avg_yield"
              stroke="#1890ff"
              strokeWidth={2}
              fill="url(#yieldGradient)"
              connectNulls={false}
              dot={(props: any) => {
                const { cx, cy, payload } = props
                if (payload.avg_yield == null) return <circle key={`dot-null-${cx}`} cx={cx} cy={cy} r={0} />
                const color = yieldColor(payload.avg_yield)
                return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Recent Alarms Panel
// ---------------------------------------------------------------------------

interface RecentAlarmsProps {
  alarms: RecentAlarm[]
  loading: boolean
  onViewAll: () => void
}

function RecentAlarmsPanel({ alarms, loading, onViewAll }: RecentAlarmsProps) {
  return (
    <Card
      title={
        <Space>
          <AlertOutlined style={{ color: '#f5222d' }} />
          <span>未解決設備異常</span>
        </Space>
      }
      extra={
        <a onClick={onViewAll} style={{ fontSize: 13 }}>查看全部</a>
      }
      style={{ height: '100%', borderRadius: 10 }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : alarms.length === 0 ? (
        <Empty
          image={
            <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
          }
          description={
            <Text style={{ color: '#52c41a', fontWeight: 500 }}>目前無未解決異常</Text>
          }
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={0}>
          {alarms.map((alarm, idx) => {
            const cfg = severityConfig[alarm.severity] ?? { color: '#8c8c8c', label: alarm.severity }
            return (
              <React.Fragment key={alarm.id}>
                {idx > 0 && <Divider style={{ margin: '4px 0' }} />}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 12,
                    padding: '8px 0',
                  }}
                >
                  {/* Severity border strip */}
                  <div
                    style={{
                      width: 4,
                      borderRadius: 2,
                      background: cfg.color,
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      minHeight: 40,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <Text strong style={{ fontSize: 13, flex: 1 }} ellipsis>
                        {alarm.equipment_name}
                      </Text>
                      <Tag
                        color={cfg.color}
                        style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px', margin: 0 }}
                      >
                        {cfg.label}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }} ellipsis>
                      {alarm.title}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {timeAgo(alarm.occurred_at)}
                    </Text>
                  </div>
                </div>
              </React.Fragment>
            )
          })}
        </Space>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Overdue PM Table
// ---------------------------------------------------------------------------

interface OverduePmTableProps {
  data: OverduePm[]
  loading: boolean
  onViewAll: () => void
}

function OverduePmTable({ data, loading, onViewAll }: OverduePmTableProps) {
  const columns = [
    {
      title: '設備',
      dataIndex: 'equipment_name',
      key: 'equipment_name',
      ellipsis: true,
      render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'PM 項目',
      dataIndex: 'pm_name',
      key: 'pm_name',
      ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: '到期日',
      dataIndex: 'next_pm_date',
      key: 'next_pm_date',
      render: (v: string) => <Text style={{ fontSize: 12, color: '#595959' }}>{v}</Text>,
    },
    {
      title: '逾期天數',
      dataIndex: 'days_overdue',
      key: 'days_overdue',
      render: (v: number) => (
        <Tag color="error" style={{ fontWeight: 600 }}>
          {v} 天
        </Tag>
      ),
    },
  ]

  return (
    <Card
      title={
        <Space>
          <ToolOutlined style={{ color: '#fa8c16' }} />
          <span>逾期 PM 排程</span>
        </Space>
      }
      extra={
        <a onClick={onViewAll} style={{ fontSize: 13 }}>查看全部</a>
      }
      style={{ height: '100%', borderRadius: 10 }}
      bodyStyle={{ padding: '0 0 8px' }}
    >
      {loading ? (
        <div style={{ padding: 16 }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : data.length === 0 ? (
        <Empty
          image={
            <CheckCircleOutlined style={{ fontSize: 36, color: '#52c41a' }} />
          }
          description={<Text style={{ color: '#52c41a', fontWeight: 500 }}>無逾期 PM</Text>}
          style={{ padding: '24px 0' }}
        />
      ) : (
        <Table
          dataSource={data.slice(0, 5)}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          style={{ fontSize: 13 }}
        />
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Recent Yield Table
// ---------------------------------------------------------------------------

interface RecentYieldTableProps {
  data: RecentYieldRecord[]
  loading: boolean
  onViewAll: () => void
}

function RecentYieldTable({ data, loading, onViewAll }: RecentYieldTableProps) {
  const columns = [
    {
      title: '日期',
      dataIndex: 'measurement_date',
      key: 'measurement_date',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Lot ID',
      dataIndex: 'lot_id',
      key: 'lot_id',
      ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: '產品',
      dataIndex: 'product_name',
      key: 'product_name',
      ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '站點',
      dataIndex: 'step_name',
      key: 'step_name',
      ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '良率',
      dataIndex: 'yield_pct',
      key: 'yield_pct',
      render: (v: number) => (
        <Text strong style={{ color: yieldColor(v), fontSize: 13 }}>
          {v.toFixed(1)}%
        </Text>
      ),
    },
  ]

  return (
    <Card
      title={
        <Space>
          <BarChartOutlined style={{ color: '#722ed1' }} />
          <span>近期良率記錄</span>
        </Space>
      }
      extra={
        <a onClick={onViewAll} style={{ fontSize: 13 }}>查看全部</a>
      }
      style={{ height: '100%', borderRadius: 10 }}
      bodyStyle={{ padding: '0 0 8px' }}
    >
      {loading ? (
        <div style={{ padding: 16 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : data.length === 0 ? (
        <Empty description="暫無良率記錄" style={{ padding: '24px 0' }} />
      ) : (
        <Table
          dataSource={data.slice(0, 8)}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Quick Access Module Cards
// ---------------------------------------------------------------------------

interface ModuleCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  color: string
  borderColor: string
  path: string
  navigate: (path: string) => void
}

function ModuleCard({ icon, title, subtitle, color, borderColor, path, navigate }: ModuleCardProps) {
  return (
    <Card
      hoverable
      onClick={() => navigate(path)}
      style={{
        background: color,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        height: '100%',
      }}
      bodyStyle={{ padding: '20px 24px' }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-3px)'
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = ''
      }}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>{icon}</div>
        <Title level={5} style={{ margin: 0, fontSize: 16 }}>{title}</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>{subtitle}</Text>
      </Space>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const now = new Date()
  const greeting = getGreeting(now.getHours())
  const dateLabel = formatDateChinese(now)

  // State
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recentAlarms, setRecentAlarms] = useState<RecentAlarm[]>([])
  const [recentYield, setRecentYield] = useState<RecentYieldRecord[]>([])
  const [overduePms, setOverduePms] = useState<OverduePm[]>([])
  const [yieldTrend, setYieldTrend] = useState<YieldTrendDay[]>([])
  const [products, setProducts] = useState<YieldProduct[]>([])
  const [steps, setSteps] = useState<YieldStep[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedStepId, setSelectedStepId] = useState<string>('')

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingAlarms, setLoadingAlarms] = useState(true)
  const [loadingYield, setLoadingYield] = useState(true)
  const [loadingPms, setLoadingPms] = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)

  // Fetch all dashboard data
  const fetchAll = useCallback(async () => {
    // Summary
    setLoadingSummary(true)
    getDashboardSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoadingSummary(false))

    // Recent alarms
    setLoadingAlarms(true)
    getRecentAlarms(5)
      .then(setRecentAlarms)
      .catch(() => setRecentAlarms([]))
      .finally(() => setLoadingAlarms(false))

    // Recent yield
    setLoadingYield(true)
    getRecentYield(10)
      .then(setRecentYield)
      .catch(() => setRecentYield([]))
      .finally(() => setLoadingYield(false))

    // Overdue PMs
    setLoadingPms(true)
    getOverduePms()
      .then(setOverduePms)
      .catch(() => setOverduePms([]))
      .finally(() => setLoadingPms(false))
  }, [])

  // Fetch yield trend (can be filtered)
  const fetchTrend = useCallback(async () => {
    setLoadingTrend(true)
    getYieldTrend7d({
      product_id: selectedProductId || undefined,
      step_id: selectedStepId || undefined,
    })
      .then(setYieldTrend)
      .catch(() => setYieldTrend([]))
      .finally(() => setLoadingTrend(false))
  }, [selectedProductId, selectedStepId])

  // Fetch filter options once
  useEffect(() => {
    getYieldProducts()
      .then(setProducts)
      .catch(() => {})
    getYieldSteps()
      .then(setSteps)
      .catch(() => {})
  }, [])

  // Initial fetch + auto-refresh every 5 min
  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Re-fetch trend when filter changes
  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  // Derived stats
  const yieldAvg7d = summary?.yield.avg_7d ?? 0
  const yieldAvg30d = summary?.yield.avg_30d ?? 0
  const alarmOrDown = summary?.equipment.alarm_or_down ?? 0
  const alarms24h = summary?.equipment.alarms_24h ?? 0
  const overduePmCount = summary?.equipment.overdue_pms ?? 0
  const upcomingPms7d = summary?.equipment.upcoming_pms_7d ?? 0
  const outOfSpecRuns = summary?.process.out_of_spec_runs_7d ?? 0
  const runs7d = summary?.process.runs_7d ?? 0
  const totalDocs = summary?.sop.total_docs ?? 0
  const totalEquipment = summary?.equipment.total ?? 0
  const records30d = summary?.yield.records_30d ?? 0

  const roleColors: Record<string, string> = {
    admin: 'red',
    engineer: 'blue',
    readonly: 'default',
  }
  const roleLabels: Record<string, string> = {
    admin: '系統管理員',
    engineer: '製程工程師',
    readonly: '唯讀使用者',
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>

      {/* ── Header / Greeting ── */}
      <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f9eb 100%)' }}>
        <Row align="middle" justify="space-between" wrap>
          <Col>
            <Title level={3} style={{ marginBottom: 4 }}>
              {greeting}，{user?.full_name}
            </Title>
            <Space>
              <Text type="secondary">{dateLabel}</Text>
              {user?.role && (
                <Tag color={roleColors[user.role]}>{roleLabels[user.role]}</Tag>
              )}
            </Space>
          </Col>
          <Col>
            <Space size="large">
              {loadingSummary ? (
                <Skeleton.Button active style={{ width: 120 }} />
              ) : (
                <Tooltip title="近30天低於90%良率批次數">
                  <Space>
                    {summary?.yield.below_90_count ? (
                      <WarningOutlined style={{ color: '#f5222d', fontSize: 18 }} />
                    ) : (
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    )}
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      低良率批次（30天）：
                      <Text strong style={{ color: summary?.yield.below_90_count ? '#f5222d' : '#52c41a' }}>
                        {summary?.yield.below_90_count ?? 0}
                      </Text>
                    </Text>
                  </Space>
                </Tooltip>
              )}
              <Text type="secondary" style={{ fontSize: 13 }}>
                每 5 分鐘自動刷新
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Row 1: 4 Stat Cards ── */}
      <Row gutter={[16, 16]}>
        {/* Yield avg 7d */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="近 7 天平均良率"
            value={yieldAvg7d}
            precision={2}
            suffix="%"
            subtitle={`近 30 天：${yieldAvg30d.toFixed(2)}%`}
            valueColor={yieldColor(yieldAvg7d)}
            icon={<RiseOutlined style={{ fontSize: 20, color: yieldColor(yieldAvg7d) }} />}
            loading={loadingSummary}
          />
        </Col>

        {/* Equipment alarm/down */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="設備異常"
            value={alarmOrDown}
            suffix="台"
            subtitle={`近 24 小時新增告警：${alarms24h} 筆`}
            valueColor={alarmOrDown > 0 ? '#f5222d' : '#52c41a'}
            icon={
              alarmOrDown > 0 ? (
                <CloseCircleOutlined style={{ fontSize: 20, color: '#f5222d' }} />
              ) : (
                <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
              )
            }
            loading={loadingSummary}
          />
        </Col>

        {/* Overdue PM */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="逾期 PM"
            value={overduePmCount}
            suffix="筆"
            subtitle={`7 天內即將到期：${upcomingPms7d} 筆`}
            valueColor={overduePmCount > 0 ? '#f5222d' : '#52c41a'}
            icon={
              overduePmCount > 0 ? (
                <ToolOutlined style={{ fontSize: 20, color: '#f5222d' }} />
              ) : (
                <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
              )
            }
            loading={loadingSummary}
          />
        </Col>

        {/* Out-of-spec process runs */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="製程超規"
            value={outOfSpecRuns}
            suffix="筆"
            subtitle={`近 7 天製程記錄：${runs7d} 筆`}
            valueColor={outOfSpecRuns > 0 ? '#fa8c16' : '#52c41a'}
            icon={
              outOfSpecRuns > 0 ? (
                <WarningOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
              ) : (
                <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
              )
            }
            loading={loadingSummary}
          />
        </Col>
      </Row>

      {/* ── Row 2: Trend Chart + Recent Alarms ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <YieldTrendChart
            data={yieldTrend}
            loading={loadingTrend}
            products={products}
            steps={steps}
            selectedProductId={selectedProductId}
            selectedStepId={selectedStepId}
            onProductChange={setSelectedProductId}
            onStepChange={setSelectedStepId}
          />
        </Col>
        <Col xs={24} lg={10}>
          <RecentAlarmsPanel
            alarms={recentAlarms}
            loading={loadingAlarms}
            onViewAll={() => navigate('/equipment')}
          />
        </Col>
      </Row>

      {/* ── Row 3: Overdue PMs + Recent Yield Records ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <OverduePmTable
            data={overduePms}
            loading={loadingPms}
            onViewAll={() => navigate('/equipment')}
          />
        </Col>
        <Col xs={24} lg={12}>
          <RecentYieldTable
            data={recentYield}
            loading={loadingYield}
            onViewAll={() => navigate('/yield')}
          />
        </Col>
      </Row>

      {/* ── Row 4: Module Quick Access ── */}
      <div>
        <Title level={5} style={{ marginBottom: 12, color: '#595959' }}>
          模組快速入口
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <ModuleCard
              icon="📋"
              title="SOP 知識庫"
              subtitle={loadingSummary ? '載入中...' : `${totalDocs} 份文件`}
              color="#e6f4ff"
              borderColor="#91caff"
              path="/sop"
              navigate={navigate}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <ModuleCard
              icon="⚙️"
              title="製程參數"
              subtitle={loadingSummary ? '載入中...' : `近 7 天 ${runs7d} 筆記錄`}
              color="#f6ffed"
              borderColor="#95de64"
              path="/process"
              navigate={navigate}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <ModuleCard
              icon="📊"
              title="良率分析"
              subtitle={loadingSummary ? '載入中...' : `近 30 天平均 ${yieldAvg30d.toFixed(1)}%`}
              color="#fff7e6"
              borderColor="#ffd591"
              path="/yield"
              navigate={navigate}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <ModuleCard
              icon="🔧"
              title="設備管理"
              subtitle={loadingSummary ? '載入中...' : `${totalEquipment} 台設備`}
              color="#fff0f6"
              borderColor="#ffadd2"
              path="/equipment"
              navigate={navigate}
            />
          </Col>
        </Row>
      </div>

      {/* ── Footer info ── */}
      <Card size="small" style={{ background: '#fafafa', borderRadius: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              FAB System v6.0.0 — Dashboard 整合總覽（Phase 6）
            </Text>
          </Col>
          <Col>
            <Space>
              <Badge status="processing" text={<Text type="secondary" style={{ fontSize: 12 }}>即時監控中</Text>} />
            </Space>
          </Col>
        </Row>
      </Card>

    </Space>
  )
}

export default Dashboard
