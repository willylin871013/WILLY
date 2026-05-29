import { useEffect, useState } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  message,
  Typography,
  Table,
  Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { createRecipe, updateRecipe } from '../api/process'
import type { ProcessRecipeListItem } from '../types'

const { TextArea } = Input
const { Text } = Typography

const PROCESS_TYPES = ['CVD', 'Etch', 'CMP', 'Diffusion', 'PVD', 'Lithography', 'Other']

interface ParamRowState {
  key: number
  name: string
  unit: string
  target: number | null
  spec_min: number | null
  spec_max: number | null
  display_order: number
}

interface Props {
  open: boolean
  recipe?: ProcessRecipeListItem | null
  onClose: () => void
  onSuccess: () => void
}

let _keyCounter = 0

export default function RecipeForm({ open, recipe, onClose, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [params, setParams] = useState<ParamRowState[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      _keyCounter = 0
      if (recipe) {
        form.setFieldsValue({
          name: recipe.name,
          description: recipe.description,
          process_type: recipe.process_type,
        })
        setParams([])
      } else {
        form.resetFields()
        setParams([])
      }
    }
  }, [open, recipe, form])

  const addParam = () => {
    _keyCounter += 1
    setParams((prev) => [
      ...prev,
      {
        key: _keyCounter,
        name: '',
        unit: '',
        target: null,
        spec_min: null,
        spec_max: null,
        display_order: prev.length,
      },
    ])
  }

  const removeParam = (key: number) => {
    setParams((prev) => prev.filter((p) => p.key !== key))
  }

  const updateParam = <K extends keyof ParamRowState>(key: number, field: K, value: ParamRowState[K]) => {
    setParams((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)))
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      // Validate params
      for (const p of params) {
        if (!p.name.trim()) {
          message.warning('參數名稱不得為空')
          return
        }
      }

      setSubmitting(true)

      if (recipe) {
        await updateRecipe(recipe.id, {
          name: values.name,
          description: values.description,
          process_type: values.process_type,
        })
        message.success('配方已更新')
      } else {
        await createRecipe({
          name: values.name,
          description: values.description,
          process_type: values.process_type,
          parameters: params.map((p, idx) => ({
            name: p.name,
            unit: p.unit || undefined,
            spec_min: p.spec_min !== null ? p.spec_min : undefined,
            spec_max: p.spec_max !== null ? p.spec_max : undefined,
            target: p.target !== null ? p.target : undefined,
            display_order: p.display_order ?? idx,
          })),
        })
        message.success('配方已建立')
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg || '操作失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<ParamRowState> = [
    {
      title: '參數名稱 *',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (_, row) => (
        <Input
          size="small"
          placeholder="參數名稱"
          value={row.name}
          onChange={(e) => updateParam(row.key, 'name', e.target.value)}
          status={!row.name.trim() ? 'error' : undefined}
        />
      ),
    },
    {
      title: '單位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      render: (_, row) => (
        <Input
          size="small"
          placeholder="如 °C"
          value={row.unit}
          onChange={(e) => updateParam(row.key, 'unit', e.target.value)}
        />
      ),
    },
    {
      title: '目標值',
      dataIndex: 'target',
      key: 'target',
      width: 90,
      render: (_, row) => (
        <InputNumber
          size="small"
          placeholder="目標"
          style={{ width: '100%' }}
          value={row.target}
          onChange={(v) => updateParam(row.key, 'target', v)}
          step={0.01}
        />
      ),
    },
    {
      title: '規格下限',
      dataIndex: 'spec_min',
      key: 'spec_min',
      width: 90,
      render: (_, row) => (
        <InputNumber
          size="small"
          placeholder="最小"
          style={{ width: '100%' }}
          value={row.spec_min}
          onChange={(v) => updateParam(row.key, 'spec_min', v)}
          step={0.01}
        />
      ),
    },
    {
      title: '規格上限',
      dataIndex: 'spec_max',
      key: 'spec_max',
      width: 90,
      render: (_, row) => (
        <InputNumber
          size="small"
          placeholder="最大"
          style={{ width: '100%' }}
          value={row.spec_max}
          onChange={(v) => updateParam(row.key, 'spec_max', v)}
          step={0.01}
        />
      ),
    },
    {
      title: '順序',
      dataIndex: 'display_order',
      key: 'display_order',
      width: 70,
      render: (_, row) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          value={row.display_order}
          onChange={(v) => updateParam(row.key, 'display_order', v ?? 0)}
          min={0}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 40,
      render: (_, row) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeParam(row.key)}
        />
      ),
    },
  ]

  return (
    <Modal
      title={recipe ? '編輯配方' : '新增配方'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="儲存"
      cancelText="取消"
      confirmLoading={submitting}
      width={920}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Space style={{ width: '100%' }} size={16} wrap>
          <Form.Item
            name="name"
            label="配方名稱"
            rules={[{ required: true, message: '請輸入配方名稱' }]}
            style={{ width: 260, marginBottom: 12 }}
          >
            <Input placeholder="例: CVD-SiO2" />
          </Form.Item>

          <Form.Item
            name="process_type"
            label="製程類型"
            rules={[{ required: true, message: '請選擇製程類型' }]}
            style={{ width: 180, marginBottom: 12 }}
          >
            <Select
              placeholder="選擇類型"
              options={PROCESS_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Form.Item>
        </Space>

        <Form.Item name="description" label="描述" style={{ marginBottom: 12 }}>
          <TextArea rows={2} placeholder="配方描述（可選）" />
        </Form.Item>

        {!recipe && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>參數定義</Text>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={addParam}
              >
                新增參數
              </Button>
            </div>
            {params.length > 0 ? (
              <Table
                columns={columns}
                dataSource={params}
                rowKey="key"
                pagination={false}
                size="small"
                scroll={{ y: 240 }}
              />
            ) : (
              <div
                style={{
                  border: '1px dashed #d9d9d9',
                  borderRadius: 4,
                  padding: '24px',
                  textAlign: 'center',
                  color: '#bfbfbf',
                }}
              >
                尚無參數，點擊「新增參數」新增
              </div>
            )}
          </>
        )}
      </Form>
    </Modal>
  )
}
