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
import type { Equipment, User, MaintenanceCreate, MaintenanceType } from '../types'
import { createMaintenance } from '../api/equipment'

const { TextArea } = Input
const { Option } = Select

interface Props {
  open: boolean
  equipments: Equipment[]
  users: User[]
  defaultEquipmentId?: string
  onClose: () => void
  onSuccess: () => void
}

const maintenanceTypeOptions: { value: MaintenanceType; label: string }[] = [
  { value: 'repair', label: '故障維修 (Repair)' },
  { value: 'pm', label: '預防保養 (PM)' },
  { value: 'calibration', label: '校正 (Calibration)' },
  { value: 'inspection', label: '巡檢 (Inspection)' },
]

export default function MaintenanceForm({
  open,
  equipments,
  users,
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
      form.setFieldValue('start_time', dayjs())
      form.setFieldValue('maintenance_type', 'repair')
    }
  }, [open, defaultEquipmentId, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const payload: MaintenanceCreate = {
        equipment_id: values.equipment_id,
        maintenance_type: values.maintenance_type,
        title: values.title,
        description: values.description,
        start_time: values.start_time
          ? values.start_time.toISOString()
          : new Date().toISOString(),
        end_time: values.end_time ? values.end_time.toISOString() : undefined,
        engineer_id: values.engineer_id || undefined,
        parts_replaced: values.parts_replaced || undefined,
        cost: values.cost || undefined,
        result: values.result || undefined,
      }
      await createMaintenance(payload)
      message.success('維修記錄已建立')
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
      title="新增維修記錄"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="建立"
      cancelText="取消"
      width={720}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="maintenance_type"
            label="維修類型"
            rules={[{ required: true, message: '請選擇維修類型' }]}
          >
            <Select>
              {maintenanceTypeOptions.map((t) => (
                <Option key={t.value} value={t.value}>
                  {t.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="engineer_id" label="負責工程師（選填）">
            <Select placeholder="選擇工程師" allowClear showSearch optionFilterProp="children">
              {users.map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.full_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <Form.Item
          name="title"
          label="維修標題"
          rules={[{ required: true, message: '請輸入維修標題' }]}
        >
          <Input placeholder="簡短描述維修工作" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="start_time"
            label="開始時間"
            rules={[{ required: true, message: '請選擇開始時間' }]}
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm"
            />
          </Form.Item>

          <Form.Item name="end_time" label="結束時間（選填）">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm"
            />
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label="詳細描述"
          rules={[{ required: true, message: '請輸入維修描述' }]}
        >
          <TextArea rows={3} placeholder="詳細描述維修工作內容、方法、步驟等" />
        </Form.Item>

        <Form.Item name="parts_replaced" label="更換零件（選填）">
          <TextArea rows={2} placeholder="列出更換的零件名稱及料號" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="cost" label="費用（選填）">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" prefix="NT$" />
          </Form.Item>

          <Form.Item name="result" label="維修結果（選填）">
            <Input placeholder="例：正常、待觀察、需備料" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
