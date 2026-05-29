import { useEffect, useState, useCallback } from 'react'
import {
  Tabs,
  Button,
  Input,
  Select,
  DatePicker,
  Table,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  Popconfirm,
  Modal,
  Upload,
  message,
  Slider,
  Statistic,
  InputNumber,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExpandOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  ComposedChart,
} from 'recharts'
import {
  getYieldProducts,
  getYieldSteps,
  getYieldLossCategories,
  getYieldRecords,
  deleteYieldRecord,
  importYieldRecordsCsv,
  getYieldTrend,
  getYieldSpc,
  getYieldSummary,
  getYieldPareto,
} from '../api/yield'
import type {
  YieldProduct,
  YieldStep,
  YieldLossCategory,
  YieldRecord,
  TrendRecord,
  SpcData,
  SummaryStats,
  ParetoItem,
  BulkImportResult,
} from '../types'
import YieldRecordForm from '../components/YieldRecordForm'
import { useAuth } from '../contexts/AuthContext'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

// Yield color coding
function yieldColor(pct: number): string {
  if (pct >= 95) return '#52c41a'
  if (pct >= 90) return '#faad14'
  return '#ff4d4f'
}

function cpkColor(cpk?: number): string {
  if (cpk === undefined || cpk === null) return '#8c8c8c'
  if (cpk >= 1.33) return '#52c41a'
  if (cpk >= 1.0) return '#faad14'
  return '#ff4d4f'
}

// Custom dot for SPC out-of-control points
const SpcDot = (props: {
  cx?: number
  cy?: number
  payload?: { out_of_control?: boolean }
}) => {
  const { cx = 0, cy = 0, payload } = props
  if (payload?.out_of_control) {
    return <circle cx={cx} cy={cy} r={6} fill="#ff4d4f" stroke="#fff" strokeWidth={2} />
  }
  return <circle cx={cx} cy={cy} r={4} fill="#1890ff" stroke="#fff" strokeWidth={1} />
}

export default function Yield() {
  const { user } = useAuth()
  const isReadonly = user?.role === 'readonly'
  const isAdmin = user?.role === 'admin'

  // Common data
  const [products, setProducts] = useState<YieldProduct[]>([])
  const [steps, setSteps] = useState<YieldStep[]>([])
  const [lossCategories, setLossCategories] = useState<YieldLossCategory[]>([])

  // Records tab state
  const [records, setRecords] = useState<YieldRecord[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [filterProduct, setFilterProduct] = useState<string | undefined>()
  const [filterStep, setFilterStep] = useState<string | undefined>()
  const [filterLot, setFilterLot] = useState('')
  const [filterDateRange, setFilterDateRange] = useState<[string, string] | null>(null)
  const [filterYieldRange, setFilterYieldRange] = useState<[number, number]>([0, 100])

  // Record form
  const [recordFormOpen, setRecordFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<YieldRecord | null>(null)

  // CSV import
  const [importOpen, setImportOpen] = useState(false)
  const [importFileList, setImportFileList] = useState<UploadFile[]>([])
  const [importing, setImporting] = useState(false)

  // Row expand
  const [expandedRows, setExpandedRows] = useState<string[]>([])

  // Trend tab state
  const [trendProduct, setTrendProduct] = useState<string | undefined>()
  const [trendStep, setTrendStep] = useState<string | undefined>()
  const [trendDateRange, setTrendDateRange] = useState<[string, string] | null>(null)
  const [trendTarget, setTrendTarget] = useState<number | undefined>()
  const [trendData, setTrendData] = useState<TrendRecord[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendSummary, setTrendSummary] = useState<SummaryStats | null>(null)
  const [trendPareto, setTrendPareto] = useState<ParetoItem[]>([])

  // SPC tab state
  const [spcProduct, setSpcProduct] = useState<string | undefined>()
  const [spcStep, setSpcStep] = useState<string | undefined>()
  const [spcDateRange, setSpcDateRange] = useState<[string, string] | null>(null)
  const [spcTarget, setSpcTarget] = useState<number | undefined>()
  const [spcData, setSpcData] = useState<SpcData | null>(null)
  const [spcLoading, setSpcLoading] = useState(false)

  // Load reference data
  useEffect(() => {
    getYieldProducts().then(setProducts).catch(() => {})
    getYieldSteps().then(setSteps).catch(() => {})
    getYieldLossCategories().then(setLossCategories).catch(() => {})
  }, [])

  // ---------------------------------------------------------------------------
  // Records tab
  // ---------------------------------------------------------------------------

  const loadRecords = useCallback(
    async (page = 1) => {
      setRecordsLoading(true)
      try {
        const data = await getYieldRecords({
          page,
          size: 20,
          product_id: filterProduct,
          step_id: filterStep,
          lot_id: filterLot || undefined,
          start_date: filterDateRange?.[0],
          end_date: filterDateRange?.[1],
          min_yield: filterYieldRange[0] > 0 ? filterYieldRange[0] : undefined,
          max_yield: filterYieldRange[1] < 100 ? filterYieldRange[1] : undefined,
        })
        setRecords(data.items)
        setRecordsTotal(data.total)
        setRecordsPage(page)
      } catch {
        message.error('載入良率記錄失敗')
      } finally {
        setRecordsLoading(false)
      }
    },
    [filterProduct, filterStep, filterLot, filterDateRange, filterYieldRange]
  )

  useEffect(() => {
    loadRecords(1)
  }, [loadRecords])

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteYieldRecord(id)
      message.success('記錄已刪除')
      loadRecords(recordsPage)
    } catch {
      message.error('刪除失敗')
    }
  }

  const handleImport = async () => {
    if (importFileList.length === 0) {
      message.warning('請選擇 CSV 檔案')
      return
    }
    const file = importFileList[0].originFileObj as File
    setImporting(true)
    try {
      const result: BulkImportResult = await importYieldRecordsCsv(file)
      if (result.success_count > 0) {
        message.success(`成功匯入 ${result.success_count} 筆記錄`)
      }
      if (result.error_count > 0) {
        Modal.warning({
          title: `${result.error_count} 筆匯入失敗`,
          content: (
            <ul style={{ maxHeight: 200, overflowY: 'auto' }}>
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ),
          width: 600,
        })
      }
      setImportOpen(false)
      setImportFileList([])
      loadRecords(1)
    } catch {
      message.error('匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  const downloadCsvTemplate = () => {
    const header = 'lot_id,measurement_date,product_code,step_name,yield_pct,wafer_in,notes'
    const example = 'LOT001,2024-01-15,PROD-A,Final Test,92.5,25,normal run'
    const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'yield_import_template.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  // Summary bottom row for records tab
  const visibleYields = records.map((r) => r.yield_pct)
  const recordsMean =
    visibleYields.length > 0
      ? visibleYields.reduce((a, b) => a + b, 0) / visibleYields.length
      : null
  const recordsMin = visibleYields.length > 0 ? Math.min(...visibleYields) : null
  const recordsMax = visibleYields.length > 0 ? Math.max(...visibleYields) : null

  const recordColumns: ColumnsType<YieldRecord> = [
    {
      title: '日期',
      dataIndex: 'measurement_date',
      key: 'measurement_date',
      width: 100,
      sorter: (a, b) => a.measurement_date.localeCompare(b.measurement_date),
    },
    {
      title: 'Lot ID',
      dataIndex: 'lot_id',
      key: 'lot_id',
      width: 130,
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: '產品',
      key: 'product',
      width: 130,
      render: (_, row) => (
        <Space size={2} direction="vertical" style={{ lineHeight: 1.3 }}>
          <Text style={{ fontSize: 12 }}>{row.product_code}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.product_name}
          </Text>
        </Space>
      ),
    },
    {
      title: '製程站',
      dataIndex: 'step_name',
      key: 'step_name',
      width: 100,
    },
    {
      title: '良率%',
      dataIndex: 'yield_pct',
      key: 'yield_pct',
      width: 90,
      sorter: (a, b) => a.yield_pct - b.yield_pct,
      render: (pct: number) => (
        <Tag color={yieldColor(pct)} style={{ fontWeight: 'bold', minWidth: 54, textAlign: 'center' }}>
          {pct.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: '投片數',
      dataIndex: 'wafer_in',
      key: 'wafer_in',
      width: 70,
      render: (v) => v ?? '-',
    },
    {
      title: '良率損失',
      key: 'loss',
      width: 160,
      render: (_, row) => {
        const losses = row.loss_records.slice(0, 2)
        return losses.length > 0 ? (
          <Space size={4} wrap>
            {losses.map((lr) => (
              <Tag
                key={lr.category_id}
                color={lr.color}
                style={{ fontSize: 11 }}
              >
                {lr.category_name} {lr.loss_pct.toFixed(1)}%
              </Tag>
            ))}
            {row.loss_records.length > 2 && (
              <Tag style={{ fontSize: 11 }}>+{row.loss_records.length - 2}</Tag>
            )}
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            -
          </Text>
        )
      },
    },
    {
      title: '備註',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, row: YieldRecord) => (
        <Space size={4}>
          <Tooltip title="展開損失明細">
            <Button
              type="text"
              size="small"
              icon={<ExpandOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                setExpandedRows((prev) =>
                  prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
                )
              }}
            />
          </Tooltip>
          {!isReadonly && (
            <Tooltip title="編輯">
              <Button
                type="text"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingRecord(row)
                  setRecordFormOpen(true)
                }}
              >
                編輯
              </Button>
            </Tooltip>
          )}
          {isAdmin && (
            <Popconfirm
              title="確認刪除此記錄？"
              onConfirm={() => handleDeleteRecord(row.id)}
              okText="刪除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="刪除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const recordsTab = (
    <div>
      {/* Filter bar */}
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          placeholder="選擇產品"
          style={{ width: 200 }}
          allowClear
          value={filterProduct}
          onChange={setFilterProduct}
          options={products.map((p) => ({
            value: p.id,
            label: `${p.product_code} – ${p.name}`,
          }))}
          showSearch
          optionFilterProp="label"
        />
        <Select
          placeholder="製程站點"
          style={{ width: 160 }}
          allowClear
          value={filterStep}
          onChange={setFilterStep}
          options={steps.map((s) => ({ value: s.id, label: s.name }))}
          showSearch
          optionFilterProp="label"
        />
        <Input
          placeholder="搜尋 Lot ID"
          prefix={<SearchOutlined />}
          style={{ width: 160 }}
          value={filterLot}
          onChange={(e) => setFilterLot(e.target.value)}
          allowClear
        />
        <RangePicker
          onChange={(_, strs) =>
            setFilterDateRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)
          }
          placeholder={['開始日期', '結束日期']}
        />
        <Space>
          <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            良率範圍: {filterYieldRange[0]}% – {filterYieldRange[1]}%
          </Text>
          <Slider
            range
            min={0}
            max={100}
            value={filterYieldRange}
            onChange={(v) => setFilterYieldRange(v as [number, number])}
            style={{ width: 120 }}
            tooltip={{ formatter: (v) => `${v}%` }}
          />
        </Space>
        <Button onClick={() => loadRecords(1)} type="primary" ghost>
          搜尋
        </Button>
      </Space>

      {/* Action buttons */}
      {!isReadonly && (
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRecord(null)
              setRecordFormOpen(true)
            }}
          >
            新增記錄
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            匯入 CSV
          </Button>
        </Space>
      )}

      <Table
        columns={recordColumns}
        dataSource={records}
        rowKey="id"
        loading={recordsLoading}
        size="small"
        pagination={{
          current: recordsPage,
          total: recordsTotal,
          pageSize: 20,
          showTotal: (total) => `共 ${total} 筆`,
          onChange: (page) => loadRecords(page),
        }}
        expandable={{
          expandedRowKeys: expandedRows,
          onExpand: (expanded, record) => {
            setExpandedRows(
              expanded
                ? [...expandedRows, record.id]
                : expandedRows.filter((id) => id !== record.id)
            )
          },
          expandedRowRender: (record: YieldRecord) =>
            record.loss_records.length > 0 ? (
              <Table
                size="small"
                pagination={false}
                dataSource={record.loss_records}
                rowKey="category_id"
                columns={[
                  {
                    title: '損失類別',
                    key: 'cat',
                    render: (_, lr) => (
                      <Tag color={lr.color}>{lr.category_name}</Tag>
                    ),
                  },
                  { title: '損失比例', dataIndex: 'loss_pct', render: (v) => `${v.toFixed(2)}%` },
                  { title: '備註', dataIndex: 'notes', render: (v) => v || '-' },
                ]}
              />
            ) : (
              <Text type="secondary">無損失明細記錄</Text>
            ),
        }}
        footer={() =>
          records.length > 0 ? (
            <Space size={24} style={{ padding: '4px 0' }}>
              <Text>
                本頁筆數: <Text strong>{records.length}</Text>
              </Text>
              <Text>
                平均良率:{' '}
                <Text strong style={{ color: recordsMean !== null ? yieldColor(recordsMean) : undefined }}>
                  {recordsMean !== null ? `${recordsMean.toFixed(2)}%` : '-'}
                </Text>
              </Text>
              <Text>
                最高:{' '}
                <Text strong style={{ color: '#52c41a' }}>
                  {recordsMax !== null ? `${recordsMax.toFixed(2)}%` : '-'}
                </Text>
              </Text>
              <Text>
                最低:{' '}
                <Text strong style={{ color: '#ff4d4f' }}>
                  {recordsMin !== null ? `${recordsMin.toFixed(2)}%` : '-'}
                </Text>
              </Text>
            </Space>
          ) : null
        }
      />
    </div>
  )

  // ---------------------------------------------------------------------------
  // Trend tab
  // ---------------------------------------------------------------------------

  const loadTrend = useCallback(async () => {
    if (!trendProduct) return
    setTrendLoading(true)
    try {
      const [trend, summary, pareto] = await Promise.all([
        getYieldTrend({
          product_id: trendProduct,
          step_id: trendStep,
          start_date: trendDateRange?.[0],
          end_date: trendDateRange?.[1],
        }),
        getYieldSummary({
          product_id: trendProduct,
          step_id: trendStep,
          start_date: trendDateRange?.[0],
          end_date: trendDateRange?.[1],
          target: trendTarget,
        }).catch(() => null),
        getYieldPareto({
          product_id: trendProduct,
          step_id: trendStep,
          start_date: trendDateRange?.[0],
          end_date: trendDateRange?.[1],
        }).catch(() => []),
      ])
      setTrendData(trend)
      setTrendSummary(summary)
      setTrendPareto(pareto as ParetoItem[])
    } catch {
      message.error('載入趨勢資料失敗')
    } finally {
      setTrendLoading(false)
    }
  }, [trendProduct, trendStep, trendDateRange, trendTarget])

  const chartData = trendData.map((r) => ({
    ...r,
    date: r.date,
    yield_pct: r.yield_pct,
    lot: r.lot_id,
  }))

  const trendTab = (
    <div>
      {/* Filter bar */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="選擇產品（必填）"
          style={{ width: 220 }}
          allowClear
          value={trendProduct}
          onChange={setTrendProduct}
          options={products.map((p) => ({
            value: p.id,
            label: `${p.product_code} – ${p.name}`,
          }))}
          showSearch
          optionFilterProp="label"
        />
        <Select
          placeholder="製程站點"
          style={{ width: 160 }}
          allowClear
          value={trendStep}
          onChange={setTrendStep}
          options={steps.map((s) => ({ value: s.id, label: s.name }))}
          showSearch
          optionFilterProp="label"
        />
        <RangePicker
          onChange={(_, strs) =>
            setTrendDateRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)
          }
          placeholder={['開始日期', '結束日期']}
        />
        <Space>
          <Text style={{ fontSize: 12 }}>目標良率:</Text>
          <InputNumber
            min={0}
            max={100}
            step={0.5}
            placeholder="例: 90"
            value={trendTarget}
            onChange={(v) => setTrendTarget(v ?? undefined)}
            suffix="%"
            style={{ width: 100 }}
          />
        </Space>
        <Button type="primary" onClick={loadTrend} loading={trendLoading} disabled={!trendProduct}>
          查詢
        </Button>
      </Space>

      {trendData.length === 0 ? (
        <Empty description={trendProduct ? '無資料，請調整篩選條件' : '請先選擇產品'} />
      ) : (
        <>
          {/* Trend chart */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-30}
                  textAnchor="end"
                  height={50}
                  tick={{ fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={50} />
                <RechartTooltip
                  formatter={(value: number, _name: string, item: { payload?: { lot?: string } }) => [
                    `${value.toFixed(2)}%`,
                    item.payload?.lot || '良率',
                  ]}
                  labelFormatter={(label) => `日期: ${label}`}
                />
                <Legend />
                {trendSummary && (
                  <ReferenceLine
                    y={trendSummary.mean}
                    stroke="#52c41a"
                    strokeDasharray="6 3"
                    label={{ value: `平均 ${trendSummary.mean.toFixed(2)}%`, fill: '#52c41a', fontSize: 11 }}
                  />
                )}
                {trendTarget !== undefined && trendTarget !== null && (
                  <ReferenceLine
                    y={trendTarget}
                    stroke="#faad14"
                    strokeDasharray="6 3"
                    label={{ value: `目標 ${trendTarget}%`, fill: '#faad14', fontSize: 11 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="yield_pct"
                  name="良率%"
                  stroke="#1890ff"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* Summary stats */}
          {trendSummary && (
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              {[
                { title: '筆數', value: trendSummary.count, suffix: '筆', color: '#1890ff' },
                {
                  title: '平均良率',
                  value: trendSummary.mean.toFixed(2),
                  suffix: '%',
                  color: yieldColor(trendSummary.mean),
                },
                {
                  title: '標準差',
                  value: trendSummary.std.toFixed(4),
                  suffix: '%',
                  color: '#595959',
                },
                {
                  title: '最小',
                  value: trendSummary.min.toFixed(2),
                  suffix: '%',
                  color: '#ff4d4f',
                },
                {
                  title: '最大',
                  value: trendSummary.max.toFixed(2),
                  suffix: '%',
                  color: '#52c41a',
                },
                {
                  title: 'Cpk',
                  value:
                    trendSummary.cpk !== undefined && trendSummary.cpk !== null
                      ? trendSummary.cpk.toFixed(3)
                      : '—',
                  suffix: '',
                  color: cpkColor(trendSummary.cpk),
                },
              ].map((stat) => (
                <Col key={stat.title} xs={12} sm={8} md={4}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title={stat.title}
                      value={stat.value}
                      suffix={stat.suffix}
                      valueStyle={{ color: stat.color, fontSize: 18 }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {/* Loss pareto */}
          {trendPareto.length > 0 && (
            <Card size="small" title="良率損失柏拉圖">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={trendPareto}
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category_name"
                    tick={{ fontSize: 12 }}
                    width={90}
                  />
                  <RechartTooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, '損失比例']}
                  />
                  <Bar dataKey="total_loss_pct" name="損失%" radius={[0, 4, 4, 0]}>
                    {trendPareto.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )

  // ---------------------------------------------------------------------------
  // SPC tab
  // ---------------------------------------------------------------------------

  const loadSpc = useCallback(async () => {
    if (!spcProduct) return
    setSpcLoading(true)
    try {
      const data = await getYieldSpc({
        product_id: spcProduct,
        step_id: spcStep,
        start_date: spcDateRange?.[0],
        end_date: spcDateRange?.[1],
        target: spcTarget,
      })
      setSpcData(data)
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } }
      const detail = apiErr?.response?.data?.detail
      if (detail) {
        message.warning(detail)
      } else {
        message.error('載入管制圖失敗')
      }
      setSpcData(null)
    } finally {
      setSpcLoading(false)
    }
  }, [spcProduct, spcStep, spcDateRange, spcTarget])

  // Build chart data arrays for SPC
  const iChartData = spcData
    ? spcData.points.map((p) => ({
        lot_id: p.lot_id,
        date: p.date,
        value: p.value,
        out_of_control: p.out_of_control,
      }))
    : []

  const mrChartData = spcData
    ? spcData.points
        .filter((p) => p.mr !== undefined && p.mr !== null)
        .map((p) => ({
          lot_id: p.lot_id,
          date: p.date,
          mr: p.mr,
        }))
    : []

  const spcTab = (
    <div>
      {/* Filter bar */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="選擇產品（必填）"
          style={{ width: 220 }}
          allowClear
          value={spcProduct}
          onChange={setSpcProduct}
          options={products.map((p) => ({
            value: p.id,
            label: `${p.product_code} – ${p.name}`,
          }))}
          showSearch
          optionFilterProp="label"
        />
        <Select
          placeholder="製程站點"
          style={{ width: 160 }}
          allowClear
          value={spcStep}
          onChange={setSpcStep}
          options={steps.map((s) => ({ value: s.id, label: s.name }))}
          showSearch
          optionFilterProp="label"
        />
        <RangePicker
          onChange={(_, strs) =>
            setSpcDateRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)
          }
          placeholder={['開始日期', '結束日期']}
        />
        <Space>
          <Text style={{ fontSize: 12 }}>目標良率 (LSL):</Text>
          <InputNumber
            min={0}
            max={100}
            step={0.5}
            placeholder="例: 90"
            value={spcTarget}
            onChange={(v) => setSpcTarget(v ?? undefined)}
            suffix="%"
            style={{ width: 100 }}
          />
        </Space>
        <Button
          type="primary"
          onClick={loadSpc}
          loading={spcLoading}
          disabled={!spcProduct}
        >
          繪製管制圖
        </Button>
      </Space>

      {!spcData ? (
        <Empty description={spcProduct ? '點擊「繪製管制圖」載入資料' : '請先選擇產品'} />
      ) : (
        <>
          {/* I Chart */}
          <Card
            size="small"
            title="個別值管制圖 (I Chart)"
            style={{ marginBottom: 16 }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={iChartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="lot_id"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  domain={[
                    Math.max(0, spcData.lcl - 5),
                    Math.min(100, spcData.ucl + 5),
                  ]}
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  width={55}
                />
                <RechartTooltip
                  formatter={(value: number, _name: string, item: { payload?: { lot_id?: string; out_of_control?: boolean } }) => [
                    `${value.toFixed(3)}%`,
                    item.payload?.out_of_control ? '⚠ 超出管制界限' : '良率',
                  ]}
                  labelFormatter={(label) => `Lot: ${label}`}
                />
                <ReferenceLine
                  y={spcData.ucl}
                  stroke="#ff4d4f"
                  strokeWidth={1.5}
                  label={{ value: `UCL=${spcData.ucl.toFixed(2)}%`, fill: '#ff4d4f', fontSize: 11, position: 'right' }}
                />
                <ReferenceLine
                  y={spcData.mean}
                  stroke="#52c41a"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: `X̄=${spcData.mean.toFixed(2)}%`, fill: '#52c41a', fontSize: 11, position: 'right' }}
                />
                <ReferenceLine
                  y={spcData.lcl}
                  stroke="#ff4d4f"
                  strokeWidth={1.5}
                  label={{ value: `LCL=${spcData.lcl.toFixed(2)}%`, fill: '#ff4d4f', fontSize: 11, position: 'right' }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name="良率%"
                  stroke="#1890ff"
                  strokeWidth={1.5}
                  dot={<SpcDot />}
                  activeDot={{ r: 7 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* MR Chart */}
          <Card size="small" title="移動全距管制圖 (MR Chart)" style={{ marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={mrChartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="lot_id"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10 }}
                />
                <YAxis width={55} tickFormatter={(v) => v.toFixed(2)} />
                <RechartTooltip
                  formatter={(value: number) => [`${value.toFixed(3)}%`, 'MR']}
                  labelFormatter={(label) => `Lot: ${label}`}
                />
                <ReferenceLine
                  y={spcData.mr_ucl}
                  stroke="#ff4d4f"
                  strokeWidth={1.5}
                  label={{
                    value: `MR-UCL=${spcData.mr_ucl.toFixed(2)}`,
                    fill: '#ff4d4f',
                    fontSize: 11,
                    position: 'right',
                  }}
                />
                <Line
                  type="linear"
                  dataKey="mr"
                  name="MR"
                  stroke="#722ed1"
                  strokeWidth={1.5}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Process Capability Summary */}
          <Card size="small" title="製程能力摘要">
            <Row gutter={[16, 8]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="平均 (X̄)"
                  value={spcData.mean.toFixed(3)}
                  suffix="%"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="標準差 (σ)"
                  value={spcData.std.toFixed(4)}
                  suffix="%"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Cp"
                  value={
                    spcData.cp !== undefined && spcData.cp !== null
                      ? spcData.cp.toFixed(3)
                      : '—'
                  }
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Cpk"
                  value={
                    spcData.cpk !== undefined && spcData.cpk !== null
                      ? spcData.cpk.toFixed(3)
                      : '—'
                  }
                  valueStyle={{ fontSize: 18, color: cpkColor(spcData.cpk) }}
                  suffix={
                    spcData.cpk !== undefined && spcData.cpk !== null ? (
                      <Tag
                        color={cpkColor(spcData.cpk)}
                        style={{ marginLeft: 4, fontSize: 11 }}
                      >
                        {spcData.cpk >= 1.33
                          ? '良好'
                          : spcData.cpk >= 1.0
                          ? '尚可'
                          : '不足'}
                      </Tag>
                    ) : undefined
                  }
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="UCL"
                  value={spcData.ucl.toFixed(3)}
                  suffix="%"
                  valueStyle={{ fontSize: 18, color: '#ff4d4f' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="LCL"
                  value={spcData.lcl.toFixed(3)}
                  suffix="%"
                  valueStyle={{ fontSize: 18, color: '#ff4d4f' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="超出管制界限點數"
                  value={spcData.points.filter((p) => p.out_of_control).length}
                  suffix="點"
                  valueStyle={{
                    fontSize: 18,
                    color:
                      spcData.points.filter((p) => p.out_of_control).length > 0
                        ? '#ff4d4f'
                        : '#52c41a',
                  }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="資料點數"
                  value={spcData.points.length}
                  suffix="筆"
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            </Row>
            {(spcData.cp === null || spcData.cp === undefined) && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                * 請設定目標良率（LSL）以計算 Cp/Cpk
              </Text>
            )}
          </Card>
        </>
      )}
    </div>
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        良率分析
      </Title>

      <style>{`
        .yield-low-row {
          background-color: #fff1f0 !important;
        }
        .yield-low-row:hover > td {
          background-color: #ffccc7 !important;
        }
      `}</style>

      <Tabs
        defaultActiveKey="records"
        items={[
          {
            key: 'records',
            label: '良率記錄',
            children: recordsTab,
          },
          {
            key: 'trend',
            label: '趨勢分析',
            children: trendTab,
          },
          {
            key: 'spc',
            label: '管制圖 (SPC)',
            children: spcTab,
          },
        ]}
      />

      {/* Record Form Modal */}
      <YieldRecordForm
        open={recordFormOpen}
        products={products}
        steps={steps}
        lossCategories={lossCategories}
        editRecord={editingRecord}
        onClose={() => {
          setRecordFormOpen(false)
          setEditingRecord(null)
        }}
        onSuccess={() => {
          loadRecords(1)
          getYieldProducts().then(setProducts).catch(() => {})
        }}
      />

      {/* CSV Import Modal */}
      <Modal
        title="匯入 CSV 良率記錄"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false)
          setImportFileList([])
        }}
        onOk={handleImport}
        okText="開始匯入"
        cancelText="取消"
        confirmLoading={importing}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            CSV 格式：欄位包含 lot_id、measurement_date (YYYY-MM-DD)、product_code、step_name、yield_pct、wafer_in（選填）、notes（選填）
          </Text>
          <Button icon={<DownloadOutlined />} onClick={downloadCsvTemplate} size="small">
            下載範本
          </Button>
          <Upload
            accept=".csv"
            fileList={importFileList}
            beforeUpload={(file) => {
              setImportFileList([file as unknown as UploadFile])
              return false
            }}
            onRemove={() => setImportFileList([])}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>選擇 CSV 檔案</Button>
          </Upload>
        </Space>
      </Modal>
    </div>
  )
}
