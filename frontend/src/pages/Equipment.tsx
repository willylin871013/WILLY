import { useState, useEffect, useCallback } from 'react'
import {
  Tabs,
  Card,
  Row,
  Col,
  Statistic,
  Badge,
  Tag,
  Table,
  Button,
  Select,
  Input,
  DatePicker,
  Space,
  Drawer,
  Typography,
  Divider,
  List,
  Popconfirm,
  message,
  Modal,
  Form,
  Tooltip,
  InputNumber,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import type {
  Equipment,
  AlarmRecord,
  MaintenanceRecord,
  PmSchedule,
  GlobalEquipmentStats,
  EquipmentStatus,
  AlarmSeverity,
  MaintenanceType,
  EquipmentCreate,
  AlarmUpdate,
  PmCompleteRequest,
} from '../types'
import {
  getEquipmentList,
  createEquipment,
  getGlobalEquipmentStats,
  getAlarms,
  updateAlarm,
  deleteAlarm,
  getMaintenanceList,
  deleteMaintenance,
  getPmSchedules,
  deletePmSchedule,
  completePm,
} from '../api/equipment'
import { usersApi } from '../api/users'
import type { User } from '../types'
import AlarmForm from '../components/AlarmForm'
import MaintenanceForm from '../components/MaintenanceForm'
import PmScheduleForm from '../components/PmScheduleForm'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

// ---------------------------------------------------------------------------
// Color Maps
// ---------------------------------------------------------------------------

const SEVERITY_COLOR: Record<AlarmSeverity, string> = {
  critical: '#ff4d4f',
  high: '#fa8c16',
  medium: '#fadb14',
  low: '#1677ff',
}

const SEVERITY_LABEL: Record<AlarmSeverity, string> = {
  critical: '危急',
  high: '高',
  medium: '中',
  low: '低',
}

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  normal: '#52c41a',
  alarm: '#fa8c16',
  down: '#ff4d4f',
  maintenance: '#1677ff',
  pm: '#722ed1',
}

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  normal: '正常',
  alarm: '告警',
  down: '停機',
  maintenance: '維修中',
  pm: '保養中',
}

const MAINTENANCE_LABEL: Record<MaintenanceType, string> = {
  repair: '故障維修',
  pm: '預防保養',
  calibration: '校正',
  inspection: '巡檢',
}

// ---------------------------------------------------------------------------
// Equipment Tab
// ---------------------------------------------------------------------------

function EquipmentOverviewTab() {
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [stats, setStats] = useState<GlobalEquipmentStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchText, setSearchText] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null)
  const [addForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [eqList, globalStats] = await Promise.all([
        getEquipmentList({
          status: statusFilter || undefined,
          search: searchText || undefined,
        }),
        getGlobalEquipmentStats(),
      ])
      setEquipments(eqList)
      setStats(globalStats)
    } catch {
      message.error('載入設備資料失敗')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchText])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddEquipment = async () => {
    try {
      const values = await addForm.validateFields()
      const payload: EquipmentCreate = {
        name: values.name,
        equipment_id: values.equipment_id,
        equipment_type: values.equipment_type,
        location: values.location || undefined,
        status: values.status || 'normal',
        description: values.description || undefined,
      }
      await createEquipment(payload)
      message.success('設備已建立')
      setAddModalOpen(false)
      addForm.resetFields()
      loadData()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const e = err as { response?: { data?: { detail?: string } } }
      message.error(e?.response?.data?.detail || '建立失敗')
    }
  }

  return (
    <div>
      {/* Stats Bar */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title="設備總數" value={stats.total_equipment} />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="正常"
                value={stats.normal_count}
                valueStyle={{ color: STATUS_COLOR.normal }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="異常/停機"
                value={stats.alarm_count + stats.down_count}
                valueStyle={{ color: STATUS_COLOR.down }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="近30天告警"
                value={stats.total_alarms_30d}
                valueStyle={{ color: stats.total_alarms_30d > 0 ? '#fa8c16' : undefined }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="停機時數(30天)"
                value={stats.total_downtime_hours_30d}
                suffix="hr"
                precision={1}
                valueStyle={{ color: stats.total_downtime_hours_30d > 0 ? '#ff4d4f' : undefined }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="待執行 PM"
                value={stats.upcoming_pms + stats.overdue_pms}
                valueStyle={{
                  color: stats.overdue_pms > 0 ? '#ff4d4f' : stats.upcoming_pms > 0 ? '#fa8c16' : undefined,
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters and Add Button */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜尋設備名稱或編號"
          style={{ width: 240 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        <Select
          placeholder="依狀態篩選"
          style={{ width: 160 }}
          allowClear
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter(v || '')}
        >
          {Object.entries(STATUS_LABEL).map(([val, label]) => (
            <Option key={val} value={val}>
              <Badge color={STATUS_COLOR[val as EquipmentStatus]} text={label} />
            </Option>
          ))}
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          新增設備
        </Button>
      </div>

      {/* Equipment Cards */}
      <Row gutter={[16, 16]}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Col key={i} xs={24} sm={12} md={8} lg={6}>
                <Card loading />
              </Col>
            ))
          : equipments.map((eq) => (
              <Col key={eq.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedEquip(eq)
                    setDrawerOpen(true)
                  }}
                  title={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text strong style={{ fontSize: 14 }}>
                        {eq.name}
                      </Text>
                      <Tag color={STATUS_COLOR[eq.status]} style={{ marginRight: 0 }}>
                        {STATUS_LABEL[eq.status]}
                      </Tag>
                    </div>
                  }
                  size="small"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      編號：{eq.equipment_id}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      類型：{eq.equipment_type}
                    </Text>
                    {eq.location && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        位置：{eq.location}
                      </Text>
                    )}
                    <Divider style={{ margin: '8px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12 }}>近30天告警</Text>
                      <Tag color={eq.alarm_count > 0 ? 'red' : 'default'}>{eq.alarm_count}</Tag>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
      </Row>

      {equipments.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          暫無設備資料，請新增設備
        </div>
      )}

      {/* Add Equipment Modal */}
      <Modal
        title="新增設備"
        open={addModalOpen}
        onOk={handleAddEquipment}
        onCancel={() => {
          setAddModalOpen(false)
          addForm.resetFields()
        }}
        okText="建立"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="name"
              label="設備名稱"
              rules={[{ required: true, message: '請輸入設備名稱' }]}
            >
              <Input placeholder="例：CVD 反應爐 A" />
            </Form.Item>
            <Form.Item
              name="equipment_id"
              label="設備編號"
              rules={[{ required: true, message: '請輸入設備編號' }]}
            >
              <Input placeholder="例：CVD-01" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="equipment_type"
              label="設備類型"
              rules={[{ required: true, message: '請輸入設備類型' }]}
            >
              <Select placeholder="選擇類型" showSearch allowClear>
                {['CVD', 'Etch', 'CMP', 'Diffusion', 'PVD', 'Lithography', 'Metrology', 'Other'].map(
                  (t) => (
                    <Option key={t} value={t}>
                      {t}
                    </Option>
                  )
                )}
              </Select>
            </Form.Item>
            <Form.Item name="location" label="位置（選填）">
              <Input placeholder="例：Bay 3, Zone A" />
            </Form.Item>
          </div>
          <Form.Item name="status" label="初始狀態">
            <Select defaultValue="normal">
              {Object.entries(STATUS_LABEL).map(([val, label]) => (
                <Option key={val} value={val}>
                  {label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="說明（選填）">
            <Input.TextArea rows={3} placeholder="設備說明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Equipment Detail Drawer */}
      <Drawer
        title={selectedEquip ? `${selectedEquip.name} 設備詳情` : '設備詳情'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
      >
        {selectedEquip && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">設備編號</Text>
                  <Text strong>{selectedEquip.equipment_id}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">類型</Text>
                  <Text>{selectedEquip.equipment_type}</Text>
                </div>
                {selectedEquip.location && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">位置</Text>
                    <Text>{selectedEquip.location}</Text>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">狀態</Text>
                  <Tag color={STATUS_COLOR[selectedEquip.status]}>
                    {STATUS_LABEL[selectedEquip.status]}
                  </Tag>
                </div>
              </Space>
            </div>

            {selectedEquip.description && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">說明：</Text>
                <div>{selectedEquip.description}</div>
              </div>
            )}

            <Divider>最近告警記錄</Divider>
            {selectedEquip.recent_alarms.length === 0 ? (
              <Text type="secondary">無告警記錄</Text>
            ) : (
              <List
                size="small"
                dataSource={selectedEquip.recent_alarms}
                renderItem={(alarm) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Tag
                          color={SEVERITY_COLOR[alarm.severity]}
                          style={{ color: alarm.severity === 'medium' ? '#333' : '#fff' }}
                        >
                          {SEVERITY_LABEL[alarm.severity]}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(alarm.occurred_at).format('MM-DD HH:mm')}
                        </Text>
                      </div>
                      <Text style={{ fontSize: 13 }}>{alarm.title}</Text>
                      {alarm.resolved_at && (
                        <div>
                          <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            已解決 {dayjs(alarm.resolved_at).format('MM-DD HH:mm')}
                          </Text>
                        </div>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alarm Tab
// ---------------------------------------------------------------------------

function AlarmTab({ equipments }: { equipments: Equipment[] }) {
  const [alarms, setAlarms] = useState<AlarmRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [equipFilter, setEquipFilter] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [resolvedFilter, setResolvedFilter] = useState<boolean | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [searchText, setSearchText] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<AlarmRecord | null>(null)
  const [resolveForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAlarms({
        page,
        size: 20,
        equipment_id: equipFilter || undefined,
        severity: severityFilter || undefined,
        is_resolved: resolvedFilter,
        start_date: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
        search: searchText || undefined,
      })
      setAlarms(res.items)
      setTotal(res.total)
    } catch {
      message.error('載入告警記錄失敗')
    } finally {
      setLoading(false)
    }
  }, [page, equipFilter, severityFilter, resolvedFilter, dateRange, searchText])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleResolve = async () => {
    if (!resolveTarget) return
    try {
      const values = await resolveForm.validateFields()
      const payload: AlarmUpdate = {
        resolved_at: values.resolved_at
          ? values.resolved_at.toISOString()
          : new Date().toISOString(),
        root_cause: values.root_cause || undefined,
        corrective_action: values.corrective_action || undefined,
        downtime_minutes: values.downtime_minutes || undefined,
      }
      await updateAlarm(resolveTarget.id, payload)
      message.success('告警已標記為解決')
      setResolveModalOpen(false)
      resolveForm.resetFields()
      loadData()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const e = err as { response?: { data?: { detail?: string } } }
      message.error(e?.response?.data?.detail || '操作失敗')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAlarm(id)
      message.success('已刪除')
      loadData()
    } catch {
      message.error('刪除失敗')
    }
  }

  const columns: ColumnsType<AlarmRecord> = [
    {
      title: '發生時間',
      dataIndex: 'occurred_at',
      width: 140,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '設備',
      dataIndex: 'equipment_name',
      width: 120,
    },
    {
      title: '告警代碼',
      dataIndex: 'alarm_code',
      width: 100,
      render: (v) => v || '-',
    },
    {
      title: '類型',
      dataIndex: 'alarm_type',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '嚴重度',
      dataIndex: 'severity',
      width: 80,
      render: (v: AlarmSeverity) => (
        <Tag
          style={{
            backgroundColor: SEVERITY_COLOR[v],
            color: v === 'medium' ? '#333' : '#fff',
            border: 'none',
            fontWeight: 600,
          }}
        >
          {SEVERITY_LABEL[v]}
        </Tag>
      ),
    },
    {
      title: '標題',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '停機(分)',
      dataIndex: 'downtime_minutes',
      width: 90,
      render: (v) => (v != null ? v : '-'),
    },
    {
      title: '狀態',
      dataIndex: 'resolved_at',
      width: 90,
      render: (v) =>
        v ? (
          <Tag color="success">已解決</Tag>
        ) : (
          <Tag color="error">未解決</Tag>
        ),
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Space>
          {!record.resolved_at && (
            <Tooltip title="標記解決">
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  setResolveTarget(record)
                  resolveForm.setFieldValue('resolved_at', dayjs())
                  setResolveModalOpen(true)
                }}
              >
                解決
              </Button>
            </Tooltip>
          )}
          <Popconfirm
            title="確定刪除此告警記錄？"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button size="small" danger>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Select
          placeholder="選擇設備"
          style={{ width: 200 }}
          allowClear
          showSearch
          optionFilterProp="children"
          value={equipFilter || undefined}
          onChange={(v) => {
            setEquipFilter(v || '')
            setPage(1)
          }}
        >
          {equipments.map((eq) => (
            <Option key={eq.id} value={eq.id}>
              {eq.name}
            </Option>
          ))}
        </Select>

        <Select
          placeholder="嚴重程度"
          style={{ width: 120 }}
          allowClear
          value={severityFilter || undefined}
          onChange={(v) => {
            setSeverityFilter(v || '')
            setPage(1)
          }}
        >
          {Object.entries(SEVERITY_LABEL).map(([val, label]) => (
            <Option key={val} value={val}>
              <span style={{ color: SEVERITY_COLOR[val as AlarmSeverity] }}>{label}</span>
            </Option>
          ))}
        </Select>

        <Select
          placeholder="解決狀態"
          style={{ width: 120 }}
          allowClear
          value={resolvedFilter}
          onChange={(v) => {
            setResolvedFilter(v)
            setPage(1)
          }}
        >
          <Option value={false}>未解決</Option>
          <Option value={true}>已解決</Option>
        </Select>

        <RangePicker
          onChange={(dates) =>
            setDateRange(dates ? [dates[0], dates[1]] : [null, null])
          }
        />

        <Input
          prefix={<SearchOutlined />}
          placeholder="搜尋標題"
          style={{ width: 180 }}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value)
            setPage(1)
          }}
          allowClear
        />

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          新增異常
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={alarms}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
        rowClassName={(record) =>
          !record.resolved_at ? 'alarm-row-unresolved' : ''
        }
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 筆`,
        }}
      />

      <AlarmForm
        open={addOpen}
        equipments={equipments}
        onClose={() => setAddOpen(false)}
        onSuccess={loadData}
      />

      {/* Resolve Modal */}
      <Modal
        title="標記告警已解決"
        open={resolveModalOpen}
        onOk={handleResolve}
        onCancel={() => {
          setResolveModalOpen(false)
          resolveForm.resetFields()
        }}
        okText="確認解決"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        {resolveTarget && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">告警：</Text>
            <Text strong>{resolveTarget.title}</Text>
          </div>
        )}
        <Form form={resolveForm} layout="vertical">
          <Form.Item name="resolved_at" label="解決時間">
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="downtime_minutes" label="停機時間（分鐘）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="root_cause" label="根本原因">
            <Input.TextArea rows={3} placeholder="描述告警的根本原因" />
          </Form.Item>
          <Form.Item name="corrective_action" label="矯正措施">
            <Input.TextArea rows={3} placeholder="描述採取的矯正措施" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .alarm-row-unresolved {
          background-color: #fff2f0 !important;
        }
        .alarm-row-unresolved:hover > td {
          background-color: #ffebe8 !important;
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Maintenance Tab
// ---------------------------------------------------------------------------

function MaintenanceTab({
  equipments,
  users,
}: {
  equipments: Equipment[]
  users: User[]
}) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [equipFilter, setEquipFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [addOpen, setAddOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMaintenanceList({
        page,
        size: 20,
        equipment_id: equipFilter || undefined,
        maintenance_type: typeFilter || undefined,
        start_date: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      })
      setRecords(res.items)
      setTotal(res.total)
    } catch {
      message.error('載入維修記錄失敗')
    } finally {
      setLoading(false)
    }
  }, [page, equipFilter, typeFilter, dateRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = async (id: string) => {
    try {
      await deleteMaintenance(id)
      message.success('已刪除')
      loadData()
    } catch {
      message.error('刪除失敗')
    }
  }

  const columns: ColumnsType<MaintenanceRecord> = [
    {
      title: '開始時間',
      dataIndex: 'start_time',
      width: 140,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '設備',
      dataIndex: 'equipment_name',
      width: 120,
    },
    {
      title: '類型',
      dataIndex: 'maintenance_type',
      width: 100,
      render: (v: MaintenanceType) => <Tag>{MAINTENANCE_LABEL[v]}</Tag>,
    },
    {
      title: '標題',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '工程師',
      dataIndex: 'engineer_name',
      width: 100,
      render: (v) => v || '-',
    },
    {
      title: '耗時',
      width: 90,
      render: (_, record) => {
        if (!record.end_time) return '進行中'
        const mins = dayjs(record.end_time).diff(dayjs(record.start_time), 'minute')
        if (mins < 60) return `${mins} 分`
        return `${(mins / 60).toFixed(1)} 時`
      },
    },
    {
      title: '費用',
      dataIndex: 'cost',
      width: 100,
      render: (v) => (v != null ? `NT$ ${v.toLocaleString()}` : '-'),
    },
    {
      title: '操作',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="確定刪除此維修記錄？"
          onConfirm={() => handleDelete(record.id)}
          okText="確定"
          cancelText="取消"
        >
          <Button size="small" danger>
            刪除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Select
          placeholder="選擇設備"
          style={{ width: 200 }}
          allowClear
          showSearch
          optionFilterProp="children"
          value={equipFilter || undefined}
          onChange={(v) => {
            setEquipFilter(v || '')
            setPage(1)
          }}
        >
          {equipments.map((eq) => (
            <Option key={eq.id} value={eq.id}>
              {eq.name}
            </Option>
          ))}
        </Select>

        <Select
          placeholder="維修類型"
          style={{ width: 140 }}
          allowClear
          value={typeFilter || undefined}
          onChange={(v) => {
            setTypeFilter(v || '')
            setPage(1)
          }}
        >
          {Object.entries(MAINTENANCE_LABEL).map(([val, label]) => (
            <Option key={val} value={val}>
              {label}
            </Option>
          ))}
        </Select>

        <RangePicker
          onChange={(dates) =>
            setDateRange(dates ? [dates[0], dates[1]] : [null, null])
          }
        />

        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          新增維修記錄
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 筆`,
        }}
      />

      <MaintenanceForm
        open={addOpen}
        equipments={equipments}
        users={users}
        onClose={() => setAddOpen(false)}
        onSuccess={loadData}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// PM Schedule Tab
// ---------------------------------------------------------------------------

function PmScheduleTab({ equipments }: { equipments: Equipment[] }) {
  const [schedules, setSchedules] = useState<PmSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [equipFilter, setEquipFilter] = useState<string>('')
  const [addOpen, setAddOpen] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<PmSchedule | null>(null)
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [completeForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPmSchedules({
        equipment_id: equipFilter || undefined,
      })
      setSchedules(res)
    } catch {
      message.error('載入 PM 排程失敗')
    } finally {
      setLoading(false)
    }
  }, [equipFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = async (id: string) => {
    try {
      await deletePmSchedule(id)
      message.success('已刪除')
      loadData()
    } catch {
      message.error('刪除失敗')
    }
  }

  const handleComplete = async () => {
    if (!completeTarget) return
    try {
      const values = await completeForm.validateFields()
      const payload: PmCompleteRequest = {
        completed_date: values.completed_date
          ? values.completed_date.format('YYYY-MM-DD')
          : dayjs().format('YYYY-MM-DD'),
        notes: values.notes || undefined,
      }
      await completePm(completeTarget.id, payload)
      message.success('PM 已完成，下次排程已更新')
      setCompleteModalOpen(false)
      completeForm.resetFields()
      loadData()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const e = err as { response?: { data?: { detail?: string } } }
      message.error(e?.response?.data?.detail || '操作失敗')
    }
  }

  const getDaysColor = (days: number) => {
    if (days < 0) return '#ff4d4f'
    if (days <= 7) return '#fa8c16'
    return '#52c41a'
  }

  const getDaysLabel = (days: number) => {
    if (days < 0) return `逾期 ${Math.abs(days)} 天`
    if (days === 0) return '今天到期'
    return `${days} 天後`
  }

  const overdue = schedules.filter((s) => s.is_overdue)
  const upcoming = schedules.filter((s) => !s.is_overdue && s.days_until_pm <= 30)
  const other = schedules.filter((s) => !s.is_overdue && s.days_until_pm > 30)

  const columns: ColumnsType<PmSchedule> = [
    {
      title: '設備',
      dataIndex: 'equipment_name',
      width: 130,
    },
    {
      title: 'PM 項目',
      dataIndex: 'pm_name',
      ellipsis: true,
    },
    {
      title: '週期(天)',
      dataIndex: 'interval_days',
      width: 90,
      render: (v) => `${v} 天`,
    },
    {
      title: '上次執行',
      dataIndex: 'last_pm_date',
      width: 110,
      render: (v) => v || '未記錄',
    },
    {
      title: '下次到期',
      dataIndex: 'next_pm_date',
      width: 110,
      render: (v) => v || '-',
    },
    {
      title: '距今',
      dataIndex: 'days_until_pm',
      width: 100,
      render: (v: number) => (
        <Text style={{ color: getDaysColor(v), fontWeight: 600 }}>
          {getDaysLabel(v)}
        </Text>
      ),
    },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setCompleteTarget(record)
              completeForm.setFieldValue('completed_date', dayjs())
              setCompleteModalOpen(true)
            }}
          >
            完成 PM
          </Button>
          <Popconfirm
            title="確定刪除此 PM 排程？"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button size="small" danger>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const renderSection = (title: string, data: PmSchedule[], titleColor: string) => {
    if (data.length === 0) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <Title level={5} style={{ color: titleColor, marginBottom: 12 }}>
          {title}（{data.length} 筆）
        </Title>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 800 }}
          size="small"
        />
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Select
          placeholder="選擇設備"
          style={{ width: 200 }}
          allowClear
          showSearch
          optionFilterProp="children"
          value={equipFilter || undefined}
          onChange={(v) => setEquipFilter(v || '')}
        >
          {equipments.map((eq) => (
            <Option key={eq.id} value={eq.id}>
              {eq.name}
            </Option>
          ))}
        </Select>

        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          新增 PM 排程
        </Button>
      </div>

      {renderSection('逾期 PM', overdue, '#ff4d4f')}
      {renderSection('即將到期 PM（30天內）', upcoming, '#fa8c16')}
      {renderSection('全部排程', other, '#333')}

      {schedules.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          暫無 PM 排程，請新增
        </div>
      )}

      <PmScheduleForm
        open={addOpen}
        equipments={equipments}
        onClose={() => setAddOpen(false)}
        onSuccess={loadData}
      />

      {/* Complete PM Modal */}
      <Modal
        title="完成 PM"
        open={completeModalOpen}
        onOk={handleComplete}
        onCancel={() => {
          setCompleteModalOpen(false)
          completeForm.resetFields()
        }}
        okText="確認完成"
        cancelText="取消"
        width={440}
        destroyOnClose
      >
        {completeTarget && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">PM 項目：</Text>
            <Text strong>{completeTarget.pm_name}</Text>
            <br />
            <Text type="secondary">設備：</Text>
            <Text>{completeTarget.equipment_name}</Text>
          </div>
        )}
        <Form form={completeForm} layout="vertical">
          <Form.Item
            name="completed_date"
            label="完成日期"
            rules={[{ required: true, message: '請選擇完成日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="notes" label="備註（選填）">
            <Input.TextArea rows={3} placeholder="記錄 PM 完成情況、發現問題等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Equipment Page
// ---------------------------------------------------------------------------

export default function EquipmentPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    const loadShared = async () => {
      try {
        const [eqRes, usersRes] = await Promise.all([
          getEquipmentList(),
          usersApi.list({ limit: 200, is_active: true }),
        ])
        setEquipments(eqRes)
        setUsers(usersRes.items)
      } catch {
        // silently fail – each tab handles its own errors
      }
    }
    loadShared()
  }, [])

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <ToolOutlined />
          設備總覽
        </span>
      ),
      children: <EquipmentOverviewTab />,
    },
    {
      key: 'alarms',
      label: (
        <span>
          <ExclamationCircleOutlined />
          異常記錄
        </span>
      ),
      children: <AlarmTab equipments={equipments} />,
    },
    {
      key: 'maintenance',
      label: (
        <span>
          <ToolOutlined />
          維修紀錄
        </span>
      ),
      children: <MaintenanceTab equipments={equipments} users={users} />,
    },
    {
      key: 'pm',
      label: (
        <span>
          <ClockCircleOutlined />
          PM 排程
        </span>
      ),
      children: <PmScheduleTab equipments={equipments} />,
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ToolOutlined style={{ marginRight: 8 }} />
          設備記錄管理
        </Title>
        <Text type="secondary">設備異常記錄、維修紀錄與預防保養排程管理</Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  )
}
