import { useState, useEffect, useCallback } from 'react'
import {
  Layout,
  Menu,
  Input,
  Button,
  Card,
  Tag,
  Space,
  Typography,
  Spin,
  Empty,
  Pagination,
  Badge,
  Tooltip,
  message,
  Row,
  Col,
  Flex,
} from 'antd'
import {
  PlusOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileZipOutlined,
  FolderOutlined,
  SearchOutlined,
  TagsOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { SopDocument, SopCategory, SopTag } from '../types'
import {
  getCategories,
  getTags,
  getDocuments,
  createDocument,
  updateDocument,
} from '../api/sop'
import { useAuth } from '../contexts/AuthContext'
import SopForm from '../components/SopForm'
import SopDetail from './SopDetail'

const { Sider, Content } = Layout
const { Title, Text } = Typography
const { Search } = Input

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

function getFileIcon(fileName?: string) {
  if (!fileName) return <FileOutlined />
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#f5222d' }} />
  if (['doc', 'docx'].includes(ext)) return <FileWordOutlined style={{ color: '#1890ff' }} />
  if (['xls', 'xlsx'].includes(ext)) return <FileExcelOutlined style={{ color: '#52c41a' }} />
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext))
    return <FileImageOutlined style={{ color: '#722ed1' }} />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return <FileZipOutlined style={{ color: '#fa8c16' }} />
  return <FileOutlined />
}

const PAGE_SIZE = 12

function SOP() {
  const { user } = useAuth()
  const isEngineerOrAdmin = user?.role === 'admin' || user?.role === 'engineer'

  // Data
  const [categories, setCategories] = useState<SopCategory[]>([])
  const [tags, setTags] = useState<SopTag[]>([])
  const [documents, setDocuments] = useState<SopDocument[]>([])
  const [total, setTotal] = useState(0)

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // UI state
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailDoc, setDetailDoc] = useState<SopDocument | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadCategories = useCallback(async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch {
      message.error('載入分類失敗')
    }
  }, [])

  const loadTags = useCallback(async () => {
    try {
      const data = await getTags()
      setTags(data)
    } catch {
      message.error('載入標籤失敗')
    }
  }, [])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDocuments({
        page,
        size: PAGE_SIZE,
        category_id: selectedCategory ?? undefined,
        tag: selectedTag ?? undefined,
        search: search.trim() || undefined,
      })
      setDocuments(res.items)
      setTotal(res.total)
    } catch {
      message.error('載入文件失敗')
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, selectedTag, search, page])

  // Load categories and tags once on mount
  useEffect(() => {
    loadCategories()
    loadTags()
  }, [loadCategories, loadTags])

  // Reload documents when filters or page change
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleCategoryClick = (catId: string | null) => {
    setSelectedCategory(catId)
    setPage(1)
  }

  const handleTagClick = (tagName: string) => {
    setSelectedTag((prev) => (prev === tagName ? null : tagName))
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleCreateSubmit = async (
    values: {
      title: string
      description?: string
      content?: string
      category_id?: string
      tags?: string[]
    },
    file?: File,
  ) => {
    await createDocument(values, file)
    message.success('文件已建立')
    setCreateOpen(false)
    setPage(1)
    await loadDocuments()
    await loadCategories()
  }

  const handleUpdateDoc = async (
    id: string,
    values: {
      title?: string
      description?: string
      content?: string
      category_id?: string
      tags?: string[]
    },
  ) => {
    const updated = await updateDocument(id, values)
    return updated
  }

  const handleDocUpdated = (updated: SopDocument) => {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    setDetailDoc(updated)
    loadCategories()
  }

  const handleDocDeleted = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    setTotal((t) => t - 1)
  }

  const openDetail = (doc: SopDocument) => {
    setDetailDoc(doc)
    setDetailOpen(true)
  }

  // Sidebar menu items
  const sideMenuItems = [
    {
      key: 'all',
      icon: <FolderOutlined />,
      label: (
        <span>
          全部文件
          <Badge
            count={total}
            showZero
            style={{ marginLeft: 8, backgroundColor: '#1890ff' }}
            size="small"
          />
        </span>
      ),
    },
    ...categories.map((c) => ({
      key: c.id,
      icon: <FolderOutlined />,
      label: (
        <span>
          {c.name}
          {c.doc_count !== undefined && c.doc_count > 0 && (
            <Badge
              count={c.doc_count}
              style={{ marginLeft: 8, backgroundColor: '#52c41a' }}
              size="small"
            />
          )}
        </span>
      ),
    })),
  ]

  return (
    <div>
      {/* Page header */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            SOP 知識庫
          </Title>
          <Text type="secondary">管理標準作業程序與技術文件</Text>
        </div>
        <Space>
          <Tooltip title="重新整理">
            <Button icon={<ReloadOutlined />} onClick={loadDocuments} />
          </Tooltip>
          {isEngineerOrAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              新增文件
            </Button>
          )}
        </Space>
      </Flex>

      <Layout style={{ background: 'transparent', gap: 16 }}>
        {/* Category sidebar */}
        <Sider
          width={220}
          style={{
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            overflow: 'hidden',
            alignSelf: 'flex-start',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <Text strong>分類</Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedCategory ?? 'all']}
            items={sideMenuItems}
            onClick={({ key }) => handleCategoryClick(key === 'all' ? null : key)}
            style={{ border: 'none' }}
          />
        </Sider>

        {/* Main content */}
        <Content>
          {/* Search bar and tag filters */}
          <div style={{ marginBottom: 16 }}>
            <Search
              placeholder="搜尋文件標題、說明、內容..."
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              style={{ maxWidth: 480, marginBottom: 12 }}
            />
            {tags.length > 0 && (
              <div>
                <TagsOutlined style={{ marginRight: 8, color: '#8c8c8c' }} />
                {tags.map((t) => (
                  <Tag
                    key={t.id}
                    color={selectedTag === t.name ? 'blue' : 'default'}
                    style={{ cursor: 'pointer', marginBottom: 4 }}
                    onClick={() => handleTagClick(t.name)}
                  >
                    {t.name}
                  </Tag>
                ))}
                {selectedTag && (
                  <Tag
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedTag(null)
                      setPage(1)
                    }}
                  >
                    清除標籤篩選 ×
                  </Tag>
                )}
              </div>
            )}
          </div>

          {/* Document list */}
          <Spin spinning={loading}>
            {documents.length === 0 && !loading ? (
              <Empty
                description={
                  search || selectedCategory || selectedTag
                    ? '沒有符合條件的文件'
                    : '目前沒有任何文件'
                }
                style={{ padding: '60px 0' }}
              >
                {isEngineerOrAdmin && !search && !selectedCategory && !selectedTag && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateOpen(true)}
                  >
                    新增第一份文件
                  </Button>
                )}
              </Empty>
            ) : (
              <>
                <Row gutter={[16, 16]}>
                  {documents.map((doc) => (
                    <Col key={doc.id} xs={24} sm={12} lg={8} xl={6}>
                      <Card
                        hoverable
                        onClick={() => openDetail(doc)}
                        style={{ height: '100%' }}
                        styles={{ body: { padding: 16 } }}
                      >
                        {/* File icon + title */}
                        <Space align="start" style={{ marginBottom: 8, width: '100%' }}>
                          <span style={{ fontSize: 20, flexShrink: 0 }}>
                            {getFileIcon(doc.file_name)}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              strong
                              ellipsis={{ tooltip: doc.title }}
                              style={{ display: 'block', fontSize: 14 }}
                            >
                              {doc.title}
                            </Text>
                          </div>
                        </Space>

                        {/* Category and version */}
                        <Space size={4} style={{ marginBottom: 8 }}>
                          {doc.category && (
                            <Tag color="geekblue" style={{ margin: 0 }}>
                              {doc.category.name}
                            </Tag>
                          )}
                          <Tag color="blue" style={{ margin: 0 }}>
                            v{doc.version}
                          </Tag>
                        </Space>

                        {/* Description */}
                        {doc.description && (
                          <Text
                            type="secondary"
                            ellipsis={{ tooltip: doc.description }}
                            style={{ display: 'block', fontSize: 12, marginBottom: 8 }}
                          >
                            {doc.description}
                          </Text>
                        )}

                        {/* Tags */}
                        {doc.tags.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            {doc.tags.slice(0, 3).map((t) => (
                              <Tag key={t.id} color="cyan" style={{ marginBottom: 2, fontSize: 11 }}>
                                {t.name}
                              </Tag>
                            ))}
                            {doc.tags.length > 3 && (
                              <Tag style={{ fontSize: 11 }}>+{doc.tags.length - 3}</Tag>
                            )}
                          </div>
                        )}

                        {/* File size */}
                        {doc.file_name && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {doc.file_name}
                            {doc.file_size ? ` (${formatFileSize(doc.file_size)})` : ''}
                          </Text>
                        )}

                        {/* Footer: creator and date */}
                        <div
                          style={{
                            borderTop: '1px solid #f0f0f0',
                            marginTop: 8,
                            paddingTop: 8,
                          }}
                        >
                          <Flex justify="space-between">
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {doc.creator_name}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {formatDate(doc.updated_at)}
                            </Text>
                          </Flex>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>

                {/* Pagination */}
                {total > PAGE_SIZE && (
                  <Flex justify="center" style={{ marginTop: 24 }}>
                    <Pagination
                      current={page}
                      pageSize={PAGE_SIZE}
                      total={total}
                      onChange={setPage}
                      showSizeChanger={false}
                      showTotal={(t) => `共 ${t} 份文件`}
                    />
                  </Flex>
                )}
              </>
            )}
          </Spin>
        </Content>
      </Layout>

      {/* Create document modal */}
      <SopForm
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        categories={categories}
        tags={tags}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
        onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
        title="新增文件"
      />

      {/* Document detail drawer */}
      <SopDetail
        document={detailDoc}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={handleDocUpdated}
        onDeleted={handleDocDeleted}
        categories={categories}
        tags={tags}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
        onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
        onUpdate={handleUpdateDoc}
      />
    </div>
  )
}

export default SOP
