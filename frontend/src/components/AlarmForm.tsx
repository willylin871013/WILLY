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
import type { Equipment, AlarmCreate, AlarmSeverity } from '../types'
import { createAlarm } from '../api/equipment'

const { TextArea } = Input
const { Option } = Select

interface Props {
  open: boolean
  equipments: Equipment[]
  defaultEquipmentId?: string
  onClose: () => void
  onSuccess: () => void
}

const severityOptions: { value: AlarmSeverity; label: string; color: string }[] = [
  { value: 'critical', label: '危急 (Critical)', color: '#ff4d4f' },
  { value: 'high', label: '高 (High)', color: '#fa8c16' },
  { value: 'medium', label: '中 (Medium)', color: '#fadb14' },
  { value: 'low', label: '低 (Low)', color: '#1677ff' },
]

const alarmTypeOptions = [
  '溫度異常 (Temperature)',
  '壓力異常 (Pressure)',
  '顆粒污染 (Particle)',
  '流量異常 (Flow)',
  '電源異常 (Power)',
  '機械故障 (Mechanical)',
  '通訊錯誤 (Communication)',
  '其他 (Other)',
]

export default function AlarmForm({
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
      form.setFieldValue('occurred_at', dayjs())
      form.setFieldValue('severity', 'medium')
    }
  }, [open, defaultEquipmentId, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload: AlarmCreate = {
        equipment_id: values.equipment_id,
        alarm_code: values.alarm_code || undefined,
        alarm_type: values.alarm_type || undefined,
        severity: values.severity,
        title: values.title,
        description: values.description,
        occurred_at: values.occurred_at
          ? values.occurred_at.toISOString()
          : new Date().toISOString(),
        downtime_minutes: values.downtime_minutes || undefined,
      }
      await createAlarm(payload)
      message.success('告警記錄已建立')
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
      title="新增設備異常記錄"
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
          name="title"
          label="告警標題"
          rules={[{ required: true, message: '請輸入告警標題' }]}
        >
          <Input placeholder="簡短描述異常情況" />
        </Form.Item>

        <Form.Item
          name="severity"
          label="嚴重程度"
          rules={[{ required: true, message: '請選擇嚴重程度' }]}
        >
          <Select>
            {severityOptions.map((s) => (
              <Option key={s.value} value={s.value}>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="alarm_code" label="告警代碼（選填）">
            <Input placeholder="例：E001、TEMP-HIGH" />
          </Form.Item>

          <Form.Item name="alarm_type" label="告警類型（選填）">
            <Select placeholder="選擇類型" allowClear showSearch>
              {alarmTypeOptions.map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="occurred_at"
            label="發生時間"
            rules={[{ required: true, message: '請選擇發生時間' }]}
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm"
            />
          </Form.Item>

          <Form.Item name="downtime_minutes" label="停機時間（分鐘，選填）">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label="詳細描述"
          rules={[{ required: true, message: '請輸入異常描述' }]}
        >
          <TextArea rows={4} placeholder="詳細描述異常情況、現象、影響範圍等" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
