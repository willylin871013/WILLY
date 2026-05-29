import { useEffect } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  DatePicker,
  message,
} from 'antd'
import dayjs from 'dayjs'
import type { Equipment, PmScheduleCreate } from '../types'
import { createPmSchedule } from '../api/equipment'

const { TextArea } = Input
const { Option } = Select

interface Props {
  open: boolean
  equipments: Equipment[]
  defaultEquipmentId?: string
  onClose: () => void
  onSuccess: () => void
}

const intervalPresets = [
  { label: '每週 (7天)', value: 7 },
  { label: '每月 (30天)', value: 30 },
  { label: '每季 (90天)', value: 90 },
  { label: '每半年 (180天)', value: 180 },
  { label: '每年 (365天)', value: 365 },
]

export default function PmScheduleForm({
  open,
  equipments,
  defaultEquipmentId,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.resetFields()
      if (defaultEquipmentId) {
        form.setFieldValue('equipment_id', defaultEquipmentId)
      }
      form.setFieldValue('interval_days', 90)
    }
  }, [open, defaultEquipmentId, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload: PmScheduleCreate = {
        equipment_id: values.equipment_id,
        pm_name: values.pm_name,
        interval_days: values.interval_days,
        last_pm_date: values.last_pm_date
          ? values.last_pm_date.format('YYYY-MM-DD')
          : undefined,
        estimated_duration_hours: values.estimated_duration_hours || undefined,
        procedure_notes: values.procedure_notes || undefined,
      }
      await createPmSchedule(payload)
      message.success('PM 排程已建立')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const e = err as { response?: { data?: { detail?: string } } }
      message.error(e?.response?.data?.detail || '建立失敗，請稍後再試')
    }
  }

  return (
    <Modal
      title="新增 PM 排程"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="建立"
      cancelText="取消"
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="equipment_id"
          label="設備"
          rules={[{ required: true, message: '請選擇設備' }]}
        >
          <Select placeholder="請選擇設備" showSearch optionFilterProp="children">
            {equipments.map((eq) => (
              <Option key={eq.id} value={eq.id}>
                [{eq.equipment_id}] {eq.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="pm_name"
          label="PM 項目名稱"
          rules={[{ required: true, message: '請輸入 PM 項目名稱' }]}
        >
          <Input placeholder="例：季度保養、月度清潔、年度大修" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="interval_days"
            label="保養週期（天）"
            rules={[{ required: true, message: '請設定保養週期' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="90"
              addonAfter={
                <Select
                  size="small"
                  style={{ width: 140 }}
                  placeholder="快速選擇"
                  onChange={(v) => form.setFieldValue('interval_days', v)}
                >
                  {intervalPresets.map((p) => (
                    <Option key={p.value} value={p.value}>
                      {p.label}
                    </Option>
                  ))}
                </Select>
              }
            />
          </Form.Item>

          <Form.Item name="estimated_duration_hours" label="預估工時（小時，選填）">
            <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="例：4" />
          </Form.Item>
        </div>

        <Form.Item name="last_pm_date" label="上次執行日期（選填）">
          <DatePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            disabledDate={(d) => d && d > dayjs().endOf('day')}
            placeholder="若有紀錄則填寫，用以計算下次到期日"
          />
        </Form.Item>

        <Form.Item name="procedure_notes" label="作業程序說明（選填）">
          <TextArea
            rows={4}
            placeholder="描述 PM 的標準作業程序、注意事項、所需工具等"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
