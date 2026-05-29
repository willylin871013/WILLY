import { useEffect, useState } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Space,
  Typography,
  Divider,
  Tag,
  Row,
  Col,
  message,
} from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import type { YieldProduct, YieldStep, YieldLossCategory, YieldRecord } from '../types'
import { createYieldRecord, updateYieldRecord } from '../api/yield'

const { Text } = Typography

interface LossRow {
  category_id: string
  loss_pct: number | null
  notes: string
}

interface Props {
  open: boolean
  products: YieldProduct[]
  steps: YieldStep[]
  lossCategories: YieldLossCategory[]
  editRecord?: YieldRecord | null
  onClose: () => void
  onSuccess: () => void
}

function yieldColor(pct: number): string {
  if (pct >= 95) return '#52c41a'
  if (pct >= 90) return '#faad14'
  return '#ff4d4f'
}

export default function YieldRecordForm({
  open,
  products,
  steps,
  lossCategories,
  editRecord,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [lossRows, setLossRows] = useState<LossRow[]>([])
  const [yieldPct, setYieldPct] = useState<number>(100)

  const isEdit = !!editRecord

  useEffect(() => {
    if (open) {
      if (editRecord) {
        form.setFieldsValue({
          lot_id: editRecord.lot_id,
          product_id: editRecord.product_id,
          step_id: editRecord.step_id,
          // Leave measurement_date unset — user must re-pick when editing
          yield_pct: editRecord.yield_pct,
          wafer_in: editRecord.wafer_in,
          wafer_out: editRecord.wafer_out,
          die_per_wafer: editRecord.die_per_wafer,
          good_die: editRecord.good_die,
          notes: editRecord.notes,
        })
        setYieldPct(editRecord.yield_pct)
        setLossRows(
          editRecord.loss_records.map((lr) => ({
            category_id: lr.category_id,
            loss_pct: lr.loss_pct,
            notes: lr.notes || '',
          }))
        )
      } else {
        form.resetFields()
        setYieldPct(100)
        setLossRows([])
      }
    }
  }, [open, editRecord, form])

  const totalLoss = lossRows.reduce((sum, r) => sum + (r.loss_pct || 0), 0)
  const maxLoss = 100 - yieldPct

  const handleAddLoss = () => {
    setLossRows((prev) => [...prev, { category_id: '', loss_pct: null, notes: '' }])
  }

  const handleRemoveLoss = (idx: number) => {
    setLossRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleLossChange = (idx: number, field: keyof LossRow, value: string | number | null) => {
    setLossRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    )
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      // DatePicker returns a Dayjs-like object with a format method
      const datePicker = values.measurement_date as
        | { format: (f: string) => string }
        | null
        | undefined
      const measurementDate = datePicker ? datePicker.format('YYYY-MM-DD') : ''

      if (!measurementDate) {
        message.error('請選擇量測日期')
        return
      }

      // Validate loss rows
      for (let i = 0; i < lossRows.length; i++) {
        const lr = lossRows[i]
        if (!lr.category_id) {
          message.error(`第 ${i + 1} 筆損失記錄請選擇類別`)
          return
        }
        if (lr.loss_pct === null || lr.loss_pct === undefined) {
          message.error(`第 ${i + 1} 筆損失記錄請輸入損失比例`)
          return
        }
      }

      if (totalLoss > maxLoss + 0.001) {
        message.error(
          `損失總計 (${totalLoss.toFixed(2)}%) 超過允許損失上限 (${maxLoss.toFixed(2)}%)`
        )
        return
      }

      setLoading(true)

      if (isEdit && editRecord) {
        await updateYieldRecord(editRecord.id, {
          lot_id: values.lot_id,
          measurement_date: measurementDate,
          yield_pct: values.yield_pct,
          wafer_in: values.wafer_in || undefined,
          wafer_out: values.wafer_out || undefined,
          die_per_wafer: values.die_per_wafer || undefined,
          good_die: values.good_die || undefined,
          notes: values.notes || undefined,
        })
        message.success('記錄已更新')
      } else {
        await createYieldRecord({
          lot_id: values.lot_id,
          product_id: values.product_id,
          step_id: values.step_id,
          measurement_date: measurementDate,
          yield_pct: values.yield_pct,
          wafer_in: values.wafer_in || undefined,
          wafer_out: values.wafer_out || undefined,
          die_per_wafer: values.die_per_wafer || undefined,
          good_die: values.good_die || undefined,
          notes: values.notes || undefined,
          loss_records: lossRows
            .filter((lr) => lr.category_id && lr.loss_pct !== null)
            .map((lr) => ({
              category_id: lr.category_id,
              loss_pct: lr.loss_pct as number,
              notes: lr.notes || undefined,
            })),
        })
        message.success('記錄已新增')
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } }
      if (apiErr?.response?.data?.detail) {
        message.error(apiErr.response.data.detail)
      } else if (err && typeof err === 'object' && 'errorFields' in err) {
        // Form validation error — antd shows inline
      } else {
        message.error('操作失敗，請稍後再試')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={isEdit ? '編輯良率記錄' : '新增良率記錄'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEdit ? '儲存' : '新增'}
      cancelText="取消"
      confirmLoading={loading}
      width={680}
      destroyOnClose
    >
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="product_id"
              label="產品"
              rules={[{ required: !isEdit, message: '請選擇產品' }]}
            >
              <Select
                placeholder="選擇產品"
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.product_code} – ${p.name}`,
                }))}
                showSearch
                optionFilterProp="label"
                disabled={isEdit}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="step_id"
              label="製程站點"
              rules={[{ required: !isEdit, message: '請選擇製程站點' }]}
            >
              <Select
                placeholder="選擇站點"
                options={steps.map((s) => ({ value: s.id, label: s.name }))}
                showSearch
                optionFilterProp="label"
                disabled={isEdit}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="lot_id"
              label="Lot ID"
              rules={[{ required: true, message: '請輸入 Lot ID' }]}
            >
              <Input placeholder="例：LOT-2024-001" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="measurement_date"
              label="量測日期"
              rules={[{ required: true, message: '請選擇量測日期' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="選擇日期" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12} align="middle">
          <Col span={10}>
            <Form.Item
              name="yield_pct"
              label="良率 (%)"
              rules={[
                { required: true, message: '請輸入良率' },
                { type: 'number', min: 0, max: 100, message: '良率應介於 0-100' },
              ]}
            >
              <InputNumber
                min={0}
                max={100}
                step={0.1}
                precision={2}
                style={{ width: '100%' }}
                placeholder="例：92.5"
                onChange={(v) => setYieldPct(v ?? 100)}
                suffix="%"
              />
            </Form.Item>
          </Col>
          <Col span={14} style={{ paddingTop: 4 }}>
            {yieldPct !== null && (
              <Tag
                color={yieldColor(yieldPct)}
                style={{ fontSize: 16, padding: '4px 12px', marginTop: 20 }}
              >
                {yieldPct >= 95 ? '優良' : yieldPct >= 90 ? '正常' : '異常'}
              </Tag>
            )}
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={6}>
            <Form.Item name="wafer_in" label="投片數">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="片" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="wafer_out" label="出片數">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="片" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="die_per_wafer" label="每片晶粒數">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="顆" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="good_die" label="良品晶粒數">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="顆" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="notes" label="備註">
          <Input.TextArea rows={2} placeholder="備註（選填）" />
        </Form.Item>

        {!isEdit && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>
              良率損失明細（選填）
            </Divider>

            {lossRows.map((row, idx) => {
              const cat = lossCategories.find((c) => c.id === row.category_id)
              return (
                <Row key={idx} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                  <Col span={10}>
                    <Select
                      placeholder="損失類別"
                      style={{ width: '100%' }}
                      value={row.category_id || undefined}
                      onChange={(v) => handleLossChange(idx, 'category_id', v)}
                      options={lossCategories.map((c) => ({
                        value: c.id,
                        label: (
                          <Space size={4}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: c.color,
                              }}
                            />
                            {c.name}
                          </Space>
                        ),
                      }))}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.1}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="損失 %"
                      value={row.loss_pct ?? undefined}
                      onChange={(v) => handleLossChange(idx, 'loss_pct', v)}
                      suffix="%"
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <Input
                      placeholder="備註"
                      value={row.notes}
                      onChange={(e) => handleLossChange(idx, 'notes', e.target.value)}
                      size="small"
                    />
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => handleRemoveLoss(idx)}
                      size="small"
                    />
                  </Col>
                  {cat && (
                    <Col span={24} style={{ marginTop: -4, marginBottom: 2 }}>
                      <Tag color={cat.color} style={{ fontSize: 11 }}>
                        {cat.name}
                      </Tag>
                    </Col>
                  )}
                </Row>
              )
            })}

            <Space style={{ marginBottom: 8 }}>
              <Button
                icon={<PlusOutlined />}
                onClick={handleAddLoss}
                size="small"
                disabled={lossCategories.length === 0}
              >
                新增損失類別
              </Button>
              {lossRows.length > 0 && (
                <Text
                  type={totalLoss > maxLoss ? 'danger' : 'secondary'}
                  style={{ fontSize: 12 }}
                >
                  損失總計: {totalLoss.toFixed(2)}% / 允許上限: {maxLoss.toFixed(2)}%
                </Text>
              )}
            </Space>
          </>
        )}
      </Form>
    </Modal>
  )
}
