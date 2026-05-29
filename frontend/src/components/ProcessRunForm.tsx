import { useEffect, useState } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  InputNumber,
  Table,
  Typography,
  Tag,
  Space,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getRecipes, getRecipe, createRun } from '../api/process'
import type { ProcessRecipeListItem } from '../types'

const { Text } = Typography
const { TextArea } = Input

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface MeasurementRow {
  parameter_id: string
  name: string
  unit?: string
  spec_min?: number
  spec_max?: number
  target?: number
  value: string
  is_out_of_spec: boolean
}

function computeOutOfSpec(value: string, spec_min?: number, spec_max?: number): boolean {
  const num = parseFloat(value)
  if (isNaN(num)) return false
  if (spec_min !== undefined && num < spec_min) return true
  if (spec_max !== undefined && num > spec_max) return true
  return false
}

export default function ProcessRunForm({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [recipes, setRecipes] = useState<ProcessRecipeListItem[]>([])
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [loadingParams, setLoadingParams] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setLoadingRecipes(true)
      getRecipes()
        .then(setRecipes)
        .catch(() => message.error('載入配方失敗'))
        .finally(() => setLoadingRecipes(false))
      form.resetFields()
      setMeasurements([])
    }
  }, [open, form])

  const handleRecipeChange = async (recipeId: string) => {
    setLoadingParams(true)
    try {
      const recipe = await getRecipe(recipeId)
      setMeasurements(
        recipe.parameters.map((p) => ({
          parameter_id: p.id,
          name: p.name,
          unit: p.unit,
          spec_min: p.spec_min,
          spec_max: p.spec_max,
          target: p.target,
          value: '',
          is_out_of_spec: false,
        })),
      )
    } catch {
      message.error('載入參數失敗')
    } finally {
      setLoadingParams(false)
    }
  }

  const handleValueChange = (parameterId: string, val: string) => {
    setMeasurements((prev) =>
      prev.map((m) => {
        if (m.parameter_id !== parameterId) return m
        return {
          ...m,
          value: val,
          is_out_of_spec: computeOutOfSpec(val, m.spec_min, m.spec_max),
        }
      }),
    )
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      // run_date is a Dayjs object from DatePicker
      const runDate = values.run_date ? (values.run_date as { format: (f: string) => string }).format('YYYY-MM-DD') : ''

      const mInputs = measurements
        .filter((m) => m.value !== '' && !isNaN(parseFloat(m.value)))
        .map((m) => ({
          parameter_id: m.parameter_id,
          value: parseFloat(m.value),
        }))

      setSubmitting(true)
      await createRun({
        recipe_id: values.recipe_id,
        lot_id: values.lot_id,
        run_date: runDate,
        operator_id: values.operator_id ? Number(values.operator_id) : undefined,
        notes: values.notes,
        measurements: mInputs,
      })
      message.success('量測記錄已建立')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg || '建立失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const specDisplay = (row: MeasurementRow) => {
    const parts: string[] = []
    if (row.spec_min !== undefined) parts.push(`min: ${row.spec_min}`)
    if (row.spec_max !== undefined) parts.push(`max: ${row.spec_max}`)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  const columns: ColumnsType<MeasurementRow> = [
    {
      title: '參數名稱',
      dataIndex: 'name',
      key: 'name',
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
      render: (v) => (v !== undefined ? v : '-'),
    },
    {
      title: '規格範圍',
      key: 'spec',
      width: 160,
      render: (_, row) => specDisplay(row),
    },
    {
      title: '實測值',
      key: 'value',
      width: 150,
      render: (_, row) => (
        <InputNumber
          value={row.value === '' ? undefined : parseFloat(row.value)}
          onChange={(val) => handleValueChange(row.parameter_id, val !== null ? String(val) : '')}
          style={{
            width: '100%',
            borderColor: row.is_out_of_spec ? '#ff4d4f' : undefined,
          }}
          status={row.is_out_of_spec ? 'error' : undefined}
          placeholder="輸入數值"
          step={0.01}
        />
      ),
    },
    {
      title: '狀態',
      key: 'status',
      width: 80,
      render: (_, row) => {
        if (row.value === '') return null
        return row.is_out_of_spec ? (
          <Tag color="error">超規</Tag>
        ) : (
          <Tag color="success">正常</Tag>
        )
      },
    },
  ]

  return (
    <Modal
      title="新增量測記錄"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="儲存"
      cancelText="取消"
      width={900}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Space style={{ width: '100%' }} direction="horizontal" size={16}>
          <Form.Item
            name="recipe_id"
            label="製程配方"
            rules={[{ required: true, message: '請選擇配方' }]}
            style={{ width: 260, marginBottom: 12 }}
          >
            <Select
              placeholder="選擇配方"
              loading={loadingRecipes}
              onChange={handleRecipeChange}
              showSearch
              optionFilterProp="label"
              options={recipes.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.process_type})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="lot_id"
            label="Lot ID"
            rules={[{ required: true, message: '請輸入 Lot ID' }]}
            style={{ width: 200, marginBottom: 12 }}
          >
            <Input placeholder="例: LOT001" />
          </Form.Item>

          <Form.Item
            name="run_date"
            label="量測日期"
            rules={[{ required: true, message: '請選擇日期' }]}
            style={{ width: 180, marginBottom: 12 }}
          >
            <DatePicker style={{ width: '100%' }} placeholder="選擇日期" />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} direction="horizontal" size={16}>
          <Form.Item name="operator_id" label="操作員 ID（可選）" style={{ width: 180, marginBottom: 12 }}>
            <InputNumber placeholder="操作員 User ID" style={{ width: '100%' }} min={1} />
          </Form.Item>

          <Form.Item name="notes" label="備註" style={{ flex: 1, marginBottom: 12 }}>
            <TextArea rows={1} placeholder="備註說明（可選）" />
          </Form.Item>
        </Space>

        {measurements.length > 0 && (
          <>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              量測數值
            </Text>
            <Table
              columns={columns}
              dataSource={measurements}
              rowKey="parameter_id"
              pagination={false}
              loading={loadingParams}
              size="small"
              scroll={{ y: 300 }}
              rowClassName={(row) =>
                row.is_out_of_spec ? 'process-oos-row' : ''
              }
            />
          </>
        )}
      </Form>
    </Modal>
  )
}
