import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Button,
  Space,
  message,
  Divider,
  Typography,
} from 'antd'
import { InboxOutlined, PlusOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import type { SopCategory, SopTag, SopDocument } from '../types'
import { createCategory, createTag } from '../api/sop'

const { TextArea } = Input
const { Text } = Typography
const { Dragger } = Upload

interface SopFormProps {
  open: boolean
  onCancel: () => void
  onSubmit: (
    values: {
      title: string
      description?: string
      content?: string
      category_id?: string
      tags?: string[]
    },
    file?: File,
  ) => Promise<void>
  categories: SopCategory[]
  tags: SopTag[]
  initialValues?: Partial<SopDocument>
  onCategoryCreated: (cat: SopCategory) => void
  onTagCreated: (tag: SopTag) => void
  title?: string
  loading?: boolean
}

function SopForm({
  open,
  onCancel,
  onSubmit,
  categories,
  tags,
  initialValues,
  onCategoryCreated,
  onTagCreated,
  title = '新增文件',
  loading = false,
}: SopFormProps) {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [submitting, setSubmitting] = useState(false)

  // New category inline creation
  const [newCatName, setNewCatName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)

  // New tag inline creation
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
          title: initialValues.title,
          description: initialValues.description,
          content: initialValues.content,
          category_id: initialValues.category?.id,
          tags: initialValues.tags?.map((t) => t.name) ?? [],
        })
      } else {
        form.resetFields()
      }
      setFileList([])
      setNewCatName('')
      setNewTagName('')
    }
  }, [open, initialValues, form])

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    setCreatingCat(true)
    try {
      const cat = await createCategory({ name: newCatName.trim() })
      onCategoryCreated(cat)
      form.setFieldValue('category_id', cat.id)
      setNewCatName('')
      message.success(`分類「${cat.name}」已建立`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '建立分類失敗'
      message.error(msg)
    } finally {
      setCreatingCat(false)
    }
  }

  const handleAddTag = async () => {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    try {
      const tag = await createTag(newTagName.trim())
      onTagCreated(tag)
      const currentTags: string[] = form.getFieldValue('tags') ?? []
      form.setFieldValue('tags', [...currentTags, tag.name])
      setNewTagName('')
      message.success(`標籤「${tag.name}」已建立`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '建立標籤失敗'
      message.error(msg)
    } finally {
      setCreatingTag(false)
    }
  }

  const uploadProps: UploadProps = {
    fileList,
    beforeUpload: (file) => {
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        message.error('檔案大小不得超過 50MB')
        return Upload.LIST_IGNORE
      }
      setFileList([file as unknown as UploadFile])
      return false // prevent auto-upload
    },
    onRemove: () => {
      setFileList([])
    },
    maxCount: 1,
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const file = fileList.length > 0 ? (fileList[0] as unknown as File) : undefined
      await onSubmit(
        {
          title: values.title,
          description: values.description,
          content: values.content,
          category_id: values.category_id,
          tags: values.tags ?? [],
        },
        file,
      )
      form.resetFields()
      setFileList([])
    } catch (err) {
      // Validation errors are shown inline by Form; API errors bubble up
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="確認"
      cancelText="取消"
      confirmLoading={submitting || loading}
      width={680}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="title"
          label="文件標題"
          rules={[{ required: true, message: '請輸入文件標題' }]}
        >
          <Input placeholder="請輸入文件標題" maxLength={255} showCount />
        </Form.Item>

        <Form.Item name="description" label="說明">
          <TextArea
            placeholder="簡短說明此文件的用途"
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item name="content" label="內容 / 排除步驟">
          <TextArea
            placeholder="詳細內容、操作步驟、故障排除說明等"
            autoSize={{ minRows: 4, maxRows: 12 }}
          />
        </Form.Item>

        <Form.Item name="category_id" label="分類">
          <Select
            placeholder="選擇分類（可留空）"
            allowClear
            showSearch
            optionFilterProp="label"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                  <Input
                    placeholder="新增分類名稱"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ width: 200 }}
                  />
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={handleAddCategory}
                    loading={creatingCat}
                    disabled={!newCatName.trim()}
                  >
                    新增分類
                  </Button>
                </Space>
              </>
            )}
          />
        </Form.Item>

        <Form.Item name="tags" label="標籤">
          <Select
            mode="multiple"
            placeholder="選擇或輸入標籤"
            allowClear
            showSearch
            optionFilterProp="label"
            options={tags.map((t) => ({ value: t.name, label: t.name }))}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                  <Input
                    placeholder="新增標籤名稱"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ width: 200 }}
                  />
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={handleAddTag}
                    loading={creatingTag}
                    disabled={!newTagName.trim()}
                  >
                    新增標籤
                  </Button>
                </Space>
              </>
            )}
          />
        </Form.Item>

        <Form.Item label="附件（可選）">
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">點擊或拖拽檔案到此處上傳</p>
            <p className="ant-upload-hint">
              <Text type="secondary">支援任意格式，最大 50MB</Text>
            </p>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default SopForm
