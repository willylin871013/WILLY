import { useState } from 'react'
import {
  Drawer,
  Typography,
  Space,
  Tag,
  Button,
  Collapse,
  Descriptions,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Popconfirm,
  Divider,
  Empty,
  Tooltip,
} from 'antd'
import {
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  FileOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import type { SopDocument, SopCategory, SopTag } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { downloadFile, deleteDocument, createVersion } from '../api/sop'
import SopForm from '../components/SopForm'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Dragger } = Upload

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface SopDetailProps {
  document: SopDocument | null
  open: boolean
  onClose: () => void
  onUpdated: (doc: SopDocument) => void
  onDeleted: (id: string) => void
  categories: SopCategory[]
  tags: SopTag[]
  onCategoryCreated: (cat: SopCategory) => void
  onTagCreated: (tag: SopTag) => void
  onUpdate: (
    id: string,
    values: {
      title?: string
      description?: string
      content?: string
      category_id?: string
      tags?: string[]
    },
  ) => Promise<SopDocument>
}

function SopDetail({
  document: doc,
  open,
  onClose,
  onUpdated,
  onDeleted,
  categories,
  tags,
  onCategoryCreated,
  onTagCreated,
  onUpdate,
}: SopDetailProps) {
  const { user } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versionForm] = Form.useForm()
  const [versionFileList, setVersionFileList] = useState<UploadFile[]>([])
  const [creatingVersion, setCreatingVersion] = useState(false)

  const isEngineerOrAdmin = user?.role === 'admin' || user?.role === 'engineer'
  const isAdmin = user?.role === 'admin'

  const handleDownload = async () => {
    if (!doc?.file_name) return
    setDownloading(true)
    try {
      await downloadFile(doc.id, doc.file_name)
    } catch {
      message.error('下載失敗，請稍後再試')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!doc) return
    setDeleting(true)
    try {
      await deleteDocument(doc.id)
      message.success('文件已刪除')
      onDeleted(doc.id)
      onClose()
    } catch {
      message.error('刪除失敗，請稍後再試')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditSubmit = async (
    values: {
      title?: string
      description?: string
      content?: string
      category_id?: string
      tags?: string[]
    },
  ) => {
    if (!doc) return
    const updated = await onUpdate(doc.id, values)
    onUpdated(updated)
    setEditOpen(false)
    message.success('文件已更新')
  }

  const versionUploadProps: UploadProps = {
    fileList: versionFileList,
    beforeUpload: (file) => {
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        message.error('檔案大小不得超過 50MB')
        return Upload.LIST_IGNORE
      }
      setVersionFileList([file as unknown as UploadFile])
      return false
    },
    onRemove: () => setVersionFileList([]),
    maxCount: 1,
  }

  const handleCreateVersion = async () => {
    if (!doc) return
    const values = await versionForm.validateFields()
    setCreatingVersion(true)
    try {
      const file = versionFileList.length > 0 ? (versionFileList[0] as unknown as File) : undefined
      await createVersion(doc.id, { change_notes: values.change_notes, version: values.version }, file)
      message.success('版本已建立')
      setVersionOpen(false)
      versionForm.resetFields()
      setVersionFileList([])
      // Reload doc to get updated versions
      // Parent will re-fetch when user navigates away
    } catch {
      message.error('建立版本失敗，請稍後再試')
    } finally {
      setCreatingVersion(false)
    }
  }

  if (!doc) return null

  const versionItems =
    doc.versions && doc.versions.length > 0
      ? doc.versions.map((v) => ({
          key: v.id,
          label: (
            <Space>
              <Text strong>版本 {v.version}</Text>
              {v.file_name && (
                <Tag icon={<FileOutlined />} color="blue">
                  {v.file_name}
                </Tag>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {v.creator_name} · {formatDate(v.created_at)}
              </Text>
            </Space>
          ),
          children: v.change_notes ? (
            <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{v.change_notes}</Paragraph>
          ) : (
            <Text type="secondary">無變更說明</Text>
          ),
        }))
      : []

  return (
    <>
      <Drawer
        title={
          <Space>
            <span>{doc.title}</span>
            <Tag color="blue">v{doc.version}</Tag>
          </Space>
        }
        open={open}
        onClose={onClose}
        width={720}
        extra={
          <Space>
            {doc.file_name && (
              <Tooltip title={`下載 ${doc.file_name}`}>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  loading={downloading}
                >
                  下載附件
                </Button>
              </Tooltip>
            )}
            {isEngineerOrAdmin && (
              <>
                <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                  編輯
                </Button>
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => setVersionOpen(true)}
                >
                  上傳新版本
                </Button>
              </>
            )}
            {isAdmin && (
              <Popconfirm
                title="確定要刪除此文件嗎？"
                description="刪除後將無法在清單中看到此文件"
                onConfirm={handleDelete}
                okText="確定刪除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleting}>
                  刪除
                </Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        {/* Metadata */}
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 24 }}>
          <Descriptions.Item label="分類">
            {doc.category ? (
              <Tag color="geekblue">{doc.category.name}</Tag>
            ) : (
              <Text type="secondary">未分類</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="版本">
            <Tag color="blue">v{doc.version}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="建立者">{doc.creator_name}</Descriptions.Item>
          <Descriptions.Item label="最後更新">{formatDate(doc.updated_at)}</Descriptions.Item>
          <Descriptions.Item label="建立時間" span={2}>
            {formatDate(doc.created_at)}
          </Descriptions.Item>
          {doc.file_name && (
            <Descriptions.Item label="附件" span={2}>
              <Space>
                <FileOutlined />
                <Text>{doc.file_name}</Text>
                {doc.file_size && (
                  <Text type="secondary">（{formatFileSize(doc.file_size)}）</Text>
                )}
                <Button
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  loading={downloading}
                  style={{ padding: 0 }}
                >
                  下載
                </Button>
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Tags */}
        {doc.tags.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ marginRight: 8 }}>
              標籤：
            </Text>
            {doc.tags.map((t) => (
              <Tag key={t.id} color="cyan">
                {t.name}
              </Tag>
            ))}
          </div>
        )}

        {/* Description */}
        {doc.description && (
          <div style={{ marginBottom: 24 }}>
            <Title level={5}>說明</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{doc.description}</Paragraph>
          </div>
        )}

        {/* Content */}
        {doc.content && (
          <div style={{ marginBottom: 24 }}>
            <Title level={5}>內容 / 排除步驟</Title>
            <div
              style={{
                background: '#f6f8fa',
                border: '1px solid #e8e8e8',
                borderRadius: 6,
                padding: '12px 16px',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {doc.content}
            </div>
          </div>
        )}

        {!doc.description && !doc.content && (
          <Empty description="此文件沒有文字內容" style={{ margin: '32px 0' }} />
        )}

        {/* Version history */}
        <Divider />
        <Title level={5} style={{ marginBottom: 12 }}>
          <HistoryOutlined style={{ marginRight: 8 }} />
          版本歷史
        </Title>
        {versionItems.length > 0 ? (
          <Collapse items={versionItems} ghost />
        ) : (
          <Text type="secondary">尚無版本記錄</Text>
        )}
      </Drawer>

      {/* Edit modal */}
      <SopForm
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onSubmit={async (values) => {
          await handleEditSubmit(values)
        }}
        categories={categories}
        tags={tags}
        initialValues={doc}
        onCategoryCreated={onCategoryCreated}
        onTagCreated={onTagCreated}
        title="編輯文件"
      />

      {/* Upload new version modal */}
      <Modal
        title="上傳新版本"
        open={versionOpen}
        onCancel={() => {
          setVersionOpen(false)
          versionForm.resetFields()
          setVersionFileList([])
        }}
        onOk={handleCreateVersion}
        okText="確認上傳"
        cancelText="取消"
        confirmLoading={creatingVersion}
        destroyOnClose
      >
        <Form form={versionForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="version" label="版本號（留空自動遞增）">
            <Input
              placeholder={`留空則自動遞增為 ${_incrementVersion(doc.version)}`}
              maxLength={20}
            />
          </Form.Item>
          <Form.Item name="change_notes" label="變更說明">
            <TextArea
              placeholder="說明此次版本的變更內容"
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </Form.Item>
          <Form.Item label="新版本檔案（可選）">
            <Dragger {...versionUploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">點擊或拖拽新版本檔案到此處</p>
              <p className="ant-upload-hint">最大 50MB，留空則保留原檔案</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function _incrementVersion(version: string): string {
  try {
    const parts = version.split('.')
    if (parts.length >= 2) {
      const major = parseInt(parts[0], 10)
      const minor = parseInt(parts[1], 10)
      return `${major}.${minor + 1}`
    }
  } catch {
    // ignore
  }
  return version
}

export default SopDetail
