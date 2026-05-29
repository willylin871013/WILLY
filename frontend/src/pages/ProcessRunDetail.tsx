import { useEffect, useState } from 'react'
import {
  Drawer,
  Descriptions,
  Table,
  Select,
  Typography,
  Tag,
  Spin,
  Empty,
  message,
} from 'antd'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ColumnsType } from 'antd/es/table'
import { getRun, getTrend } from '../api/process'
import type { ProcessRun, ProcessMeasurement, TrendPoint } from '../types'

const { Text, Title } = Typography

interface Props {
  runId: string | null
  open: boolean
  onClose: () => void
}

export default function ProcessRunDetail({ runId, open, onClose }: Props) {
  const [run, setRun] = useState<ProcessRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedParamId, setSelectedParamId] = useState<string | null>(null)
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  useEffect(() => {
    if (open && runId) {
      setLoading(true)
      setRun(null)
      setSelectedParamId(null)
      setTrendData([])
      getRun(runId)
        .then((data) => {
          setRun(data)
          if (data.measurements.length > 0) {
            setSelectedParamId(data.measurements[0].parameter_id)
          }
        })
        .catch(() => message.error('載入記錄詳情失敗'))
        .finally(() => setLoading(false))
    }
  }, [open, runId])

  useEffect(() => {
    if (!run || !selectedParamId) return
    setTrendLoading(true)
    getTrend({ recipe_id: run.recipe_id, parameter_id: selectedParamId, limit: 20 })
      .then(setTrendData)
      .catch(() => message.error('載入趨勢資料失敗'))
      .finally(() => setTrendLoading(false))
  }, [run, selectedParamId])

  const selectedParam = run?.measurements.find((m) => m.parameter_id === selectedParamId)

  const columns: ColumnsType<ProcessMeasurement> = [
    {
      title: '參數名稱',
      dataIndex: 'parameter_name',
      key: 'parameter_name',
      width: 160,
    },
    {
      title: '單位',
      dataIndex: 'unit',
      key: 'unit',
      width: 70,
      render: (v) => v || '-',
    },
    {
      title: '目標值',
      dataIndex: 'target',
      key: 'target',
      width: 80,
      render: (v) => (v !== undefined && v !== null ? v : '-'),
    },
    {
      title: '規格下限',
      dataIndex: 'spec_min',
      key: 'spec_min',
      width: 90,
      render: (v) => (v !== undefined && v !== null ? v : '-'),
    },
    {
      title: '規格上限',
      dataIndex: 'spec_max',
      key: 'spec_max',
      width: 90,
      render: (v) => (v !== undefined && v !== null ? v : '-'),
    },
    {
      title: '實測值',
      dataIndex: 'value',
      key: 'value',
      width: 100,
      render: (v, row) => (
        <Text style={{ color: row.is_out_of_spec ? '#ff4d4f' : undefined, fontWeight: row.is_out_of_spec ? 600 : 400 }}>
          {v}
        </Text>
      ),
    },
    {
      title: '狀態',
      key: 'status',
      width: 90,
      render: (_: unknown, row: ProcessMeasurement) =>
        row.is_out_of_spec ? (
          <Tag color="error">⚠ 超規</Tag>
        ) : (
          <Tag color="success">正常</Tag>
        ),
    },
  ]

  const chartData = trendData.map((p) => ({ ...p }))

  return (
    <Drawer
      title="量測記錄詳情"
      open={open}
      onClose={onClose}
      width={820}
      destroyOnClose
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && run && (
        <>
          <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
            <Descriptions.Item label="Lot ID">
              <Text strong>{run.lot_id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="配方">{run.recipe_name}</Descriptions.Item>
            <Descriptions.Item label="量測日期">{run.run_date}</Descriptions.Item>
            <Descriptions.Item label="操作員">{run.operator_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="超規數量">
              {run.out_of_spec_count > 0 ? (
                <Tag color="error">{run.out_of_spec_count} 項超規</Tag>
              ) : (
                <Tag color="success">全部正常</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="建立時間">
              {new Date(run.created_at).toLocaleString('zh-TW')}
            </Descriptions.Item>
            {run.notes && (
              <Descriptions.Item label="備註" span={2}>
                {run.notes}
              </Descriptions.Item>
            )}
          </Descriptions>

          <Title level={5} style={{ marginBottom: 12 }}>
            量測數值
          </Title>
          <Table
            columns={columns}
            dataSource={run.measurements}
            rowKey="id"
            pagination={false}
            size="small"
            rowClassName={(row) => (row.is_out_of_spec ? 'process-oos-row' : '')}
            style={{ marginBottom: 32 }}
          />

          <Title level={5} style={{ marginBottom: 12 }}>
            趨勢圖（最近 20 筆）
          </Title>
          <div style={{ marginBottom: 12 }}>
            <Select
              style={{ width: 260 }}
              placeholder="選擇參數"
              value={selectedParamId}
              onChange={setSelectedParamId}
              options={run.measurements.map((m) => ({
                value: m.parameter_id,
                label: `${m.parameter_name}${m.unit ? ` (${m.unit})` : ''}`,
              }))}
            />
          </div>

          {trendLoading ? (
            <Spin />
          ) : trendData.length === 0 ? (
            <Empty description="無趨勢資料" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="run_date"
                  angle={-30}
                  textAnchor="end"
                  tick={{ fontSize: 11 }}
                  height={50}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number) => [val, selectedParam?.parameter_name || '數值']}
                  labelFormatter={(label) => {
                    const point = chartData.find((d) => d.run_date === label)
                    return point ? `${label} | ${point.lot_id}` : label
                  }}
                />
                <Legend />
                {selectedParam?.spec_min !== undefined && selectedParam.spec_min !== null && (
                  <ReferenceLine
                    y={selectedParam.spec_min}
                    stroke="#ff4d4f"
                    strokeDasharray="4 4"
                    label={{ value: `LSL ${selectedParam.spec_min}`, fill: '#ff4d4f', fontSize: 11 }}
                  />
                )}
                {selectedParam?.spec_max !== undefined && selectedParam.spec_max !== null && (
                  <ReferenceLine
                    y={selectedParam.spec_max}
                    stroke="#ff4d4f"
                    strokeDasharray="4 4"
                    label={{ value: `USL ${selectedParam.spec_max}`, fill: '#ff4d4f', fontSize: 11 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  name={selectedParam?.parameter_name || '數值'}
                  stroke="#1890ff"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    const { cx, cy, payload } = props
                    return (
                      <circle
                        key={`dot-${payload.run_id}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={payload.is_out_of_spec ? '#ff4d4f' : '#1890ff'}
                        stroke="white"
                        strokeWidth={1}
                      />
                    )
                  }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}

      {!loading && !run && (
        <Empty description="找不到記錄" />
      )}
    </Drawer>
  )
}
