import { useEffect, useState, useCallback } from 'react'
import {
  Tabs,
  Button,
  Input,
  Select,
  DatePicker,
  Switch,
  Table,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  Popconfirm,
  Modal,
  Upload,
  message,
  Drawer,
  Badge,
  Descriptions,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import {
  getRecipes,
  getRuns,
  deleteRecipe,
  deleteRun,
  importRunsCsv,
  getRecipe,
  deleteParameter,
} from '../api/process'
import type { ProcessRecipeListItem, ProcessRunListItem, ProcessParameter } from '../types'
import ProcessRunForm from '../components/ProcessRunForm'
import RecipeForm from '../components/RecipeForm'
import ProcessRunDetail from './ProcessRunDetail'
import { useAuth } from '../contexts/AuthContext'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const PROCESS_TYPE_COLORS: Record<string, string> = {
  CVD: 'blue',
  Etch: 'volcano',
  CMP: 'orange',
  Diffusion: 'purple',
  PVD: 'cyan',
  Lithography: 'geekblue',
  Other: 'default',
}

export default function Process() {
  const { user } = useAuth()
  const isReadonly = user?.role === 'readonly'
  const isAdmin = user?.role === 'admin'

  // Runs state
  const [runs, setRuns] = useState<ProcessRunListItem[]>([])
  const [runsTotal, setRunsTotal] = useState(0)
  const [runsPage, setRunsPage] = useState(1)
  const [runsLoading, setRunsLoading] = useState(false)
  const [recipeFilter, setRecipeFilter] = useState<string | undefined>()
  const [lotFilter, setLotFilter] = useState('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [oosFilter, setOosFilter] = useState<boolean | undefined>()

  // Recipes state
  const [recipes, setRecipes] = useState<ProcessRecipeListItem[]>([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeTypeFilter, setRecipeTypeFilter] = useState<string | undefined>()

  // Modals
  const [runFormOpen, setRunFormOpen] = useState(false)
  const [recipeFormOpen, setRecipeFormOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<ProcessRecipeListItem | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [runDetailOpen, setRunDetailOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFileList, setImportFileList] = useState<UploadFile[]>([])
  const [importing, setImporting] = useState(false)

  // Parameter drawer
  const [paramDrawerOpen, setParamDrawerOpen] = useState(false)
  const [paramRecipe, setParamRecipe] = useState<{ name: string; parameters: ProcessParameter[] } | null>(null)
  const [paramLoading, setParamLoading] = useState(false)

  const loadRuns = useCallback(async (page = 1) => {
    setRunsLoading(true)
    try {
      const params = {
        page,
        size: 20,
        recipe_id: recipeFilter,
        lot_id: lotFilter || undefined,
        start_date: dateRange?.[0],
        end_date: dateRange?.[1],
        has_out_of_spec: oosFilter,
      }
      const data = await getRuns(params)
      setRuns(data.items)
      setRunsTotal(data.total)
      setRunsPage(page)
    } catch {
      message.error('載入量測記錄失敗')
    } finally {
      setRunsLoading(false)
    }
  }, [recipeFilter, lotFilter, dateRange, oosFilter])

  const loadRecipes = useCallback(async () => {
    setRecipesLoading(true)
    try {
      const data = await getRecipes({
        process_type: recipeTypeFilter,
        search: recipeSearch || undefined,
      })
      setRecipes(data)
    } catch {
      message.error('載入配方失敗')
    } finally {
      setRecipesLoading(false)
    }
  }, [recipeTypeFilter, recipeSearch])

  // Initial load for recipe options
  const [allRecipes, setAllRecipes] = useState<ProcessRecipeListItem[]>([])
  useEffect(() => {
    getRecipes().then(setAllRecipes).catch(() => {})
  }, [])

  useEffect(() => {
    loadRuns(1)
  }, [loadRuns])

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  const handleDeleteRun = async (id: string) => {
    try {
      await deleteRun(id)
      message.success('記錄已刪除')
      loadRuns(runsPage)
    } catch {
      message.error('刪除失敗')
    }
  }

  const handleDeleteRecipe = async (id: string) => {
    try {
      await deleteRecipe(id)
      message.success('配方已刪除')
      loadRecipes()
    } catch {
      message.error('刪除失敗')
    }
  }

  const handleViewParams = async (recipeId: string, recipeName: string) => {
    setParamLoading(true)
    setParamDrawerOpen(true)
    setParamRecipe({ name: recipeName, parameters: [] })
    try {
      const r = await getRecipe(recipeId)
      setParamRecipe({ name: r.name, parameters: r.parameters })
    } catch {
      message.error('載入參數失敗')
    } finally {
      setParamLoading(false)
    }
  }

  const handleDeleteParam = async (paramId: string) => {
    try {
      await deleteParameter(paramId)
      message.success('參數已刪除')
      if (paramRecipe) {
        setParamRecipe({
          ...paramRecipe,
          parameters: paramRecipe.parameters.filter((p) => p.id !== paramId),
        })
      }
    } catch {
      message.error('刪除失敗')
    }
  }

  const handleImport = async () => {
    if (importFileList.length === 0) {
      message.warning('請選擇 CSV 檔案')
      return
    }
    const file = importFileList[0].originFileObj as File
    setImporting(true)
    try {
      const result = await importRunsCsv(file)
      if (result.success_count > 0) {
        message.success(`成功匯入 ${result.success_count} 筆記錄`)
      }
      if (result.error_count > 0) {
        Modal.warning({
          title: `${result.error_count} 筆匯入失敗`,
          content: (
            <ul style={{ maxHeight: 200, overflowY: 'auto' }}>
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ),
          width: 600,
        })
      }
      setImportOpen(false)
      setImportFileList([])
      loadRuns(1)
    } catch {
      message.error('匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  const downloadCsvTemplate = () => {
    const header = 'lot_id,run_date,recipe_name,param1_name,param2_name'
    const example = 'LOT001,2024-01-15,CVD-SiO2,850.2,2.1'
    const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'process_import_template.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  // Runs table columns
  const runColumns: ColumnsType<ProcessRunListItem> = [
    {
      title: '日期',
      dataIndex: 'run_date',
      key: 'run_date',
      width: 110,
      sorter: (a, b) => a.run_date.localeCompare(b.run_date),
    },
    {
      title: 'Lot ID',
      dataIndex: 'lot_id',
      key: 'lot_id',
      width: 120,
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: '配方',
      dataIndex: 'recipe_name',
      key: 'recipe_name',
      width: 160,
    },
    {
      title: '操作員',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100,
      render: (v) => v || '-',
    },
    {
      title: '超規數量',
      dataIndex: 'out_of_spec_count',
      key: 'out_of_spec_count',
      width: 100,
      render: (count: number) =>
        count > 0 ? (
          <Badge count={count} style={{ backgroundColor: '#ff4d4f' }} />
        ) : (
          <Tag color="success">正常</Tag>
        ),
    },
    {
      title: '備註',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, row: ProcessRunListItem) => (
        <Space size={4}>
          <Tooltip title="查看詳情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedRunId(row.id)
                setRunDetailOpen(true)
              }}
            />
          </Tooltip>
          {isAdmin && (
            <Popconfirm
              title="確認刪除此記錄？"
              onConfirm={() => handleDeleteRun(row.id)}
              okText="刪除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="刪除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // Parameter drawer columns
  const paramColumns: ColumnsType<ProcessParameter> = [
    { title: '參數名稱', dataIndex: 'name', key: 'name', width: 160 },
    { title: '單位', dataIndex: 'unit', key: 'unit', width: 70, render: (v) => v || '-' },
    { title: '目標值', dataIndex: 'target', key: 'target', width: 80, render: (v) => v ?? '-' },
    { title: '規格下限', dataIndex: 'spec_min', key: 'spec_min', width: 90, render: (v) => v ?? '-' },
    { title: '規格上限', dataIndex: 'spec_max', key: 'spec_max', width: 90, render: (v) => v ?? '-' },
    { title: '順序', dataIndex: 'display_order', key: 'display_order', width: 60 },
    ...(isAdmin
      ? [
          {
            title: '',
            key: 'del',
            width: 50,
            render: (_: unknown, row: ProcessParameter) => (
              <Popconfirm
                title="確認刪除此參數？"
                onConfirm={() => handleDeleteParam(row.id)}
                okText="刪除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          } as ColumnsType<ProcessParameter>[0],
        ]
      : []),
  ]

  const runsTab = (
    <div>
      {/* Filter bar */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="選擇配方"
          style={{ width: 220 }}
          allowClear
          value={recipeFilter}
          onChange={setRecipeFilter}
          options={allRecipes.map((r) => ({ value: r.id, label: r.name }))}
          showSearch
          optionFilterProp="label"
        />
        <Input
          placeholder="搜尋 Lot ID"
          prefix={<SearchOutlined />}
          style={{ width: 180 }}
          value={lotFilter}
          onChange={(e) => setLotFilter(e.target.value)}
          allowClear
        />
        <RangePicker
          onChange={(_, strs) =>
            setDateRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null)
          }
          placeholder={['開始日期', '結束日期']}
        />
        <Space>
          <Text>含超規:</Text>
          <Switch
            checked={oosFilter === true}
            onChange={(v) => setOosFilter(v ? true : undefined)}
          />
        </Space>
        <Button onClick={() => loadRuns(1)} type="primary" ghost>
          搜尋
        </Button>
      </Space>

      {/* Action buttons */}
      {!isReadonly && (
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setRunFormOpen(true)}
          >
            新增記錄
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportOpen(true)}
          >
            匯入 CSV
          </Button>
        </Space>
      )}

      <Table
        columns={runColumns}
        dataSource={runs}
        rowKey="id"
        loading={runsLoading}
        pagination={{
          current: runsPage,
          total: runsTotal,
          pageSize: 20,
          showTotal: (total) => `共 ${total} 筆`,
          onChange: (page) => loadRuns(page),
        }}
        size="small"
        onRow={(row) => ({
          onClick: () => {
            setSelectedRunId(row.id)
            setRunDetailOpen(true)
          },
          style: { cursor: 'pointer' },
        })}
        rowClassName={(row) => (row.out_of_spec_count > 0 ? 'process-oos-row' : '')}
      />
    </div>
  )

  const recipesTab = (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜尋配方名稱"
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
          value={recipeSearch}
          onChange={(e) => setRecipeSearch(e.target.value)}
          allowClear
        />
        <Select
          placeholder="製程類型"
          style={{ width: 160 }}
          allowClear
          value={recipeTypeFilter}
          onChange={setRecipeTypeFilter}
          options={['CVD', 'Etch', 'CMP', 'Diffusion', 'PVD', 'Lithography', 'Other'].map((t) => ({
            value: t,
            label: t,
          }))}
        />
        {!isReadonly && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRecipe(null)
              setRecipeFormOpen(true)
            }}
          >
            新增配方
          </Button>
        )}
      </Space>

      {recipesLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>載入中...</div>
      ) : recipes.length === 0 ? (
        <Empty description="尚無配方" />
      ) : (
        <Row gutter={[16, 16]}>
          {recipes.map((recipe) => (
            <Col key={recipe.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                size="small"
                hoverable
                title={
                  <Space>
                    <Text strong ellipsis style={{ maxWidth: 130 }}>
                      {recipe.name}
                    </Text>
                  </Space>
                }
                extra={
                  <Tag color={PROCESS_TYPE_COLORS[recipe.process_type] || 'default'}>
                    {recipe.process_type}
                  </Tag>
                }
                actions={[
                  <Tooltip title="查看參數" key="view">
                    <Button
                      type="text"
                      size="small"
                      icon={<UnorderedListOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewParams(recipe.id, recipe.name)
                      }}
                    />
                  </Tooltip>,
                  ...(!isReadonly
                    ? [
                        <Tooltip title="編輯" key="edit">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingRecipe(recipe)
                              setRecipeFormOpen(true)
                            }}
                          />
                        </Tooltip>,
                      ]
                    : []),
                  ...(isAdmin
                    ? [
                        <Popconfirm
                          key="delete"
                          title="確認刪除此配方？"
                          onConfirm={(e) => {
                            e?.stopPropagation()
                            handleDeleteRecipe(recipe.id)
                          }}
                          okText="刪除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <Tooltip title="刪除">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Tooltip>
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="參數數量">{recipe.parameter_count} 個</Descriptions.Item>
                  <Descriptions.Item label="建立日期">
                    {new Date(recipe.created_at).toLocaleDateString('zh-TW')}
                  </Descriptions.Item>
                  {recipe.description && (
                    <Descriptions.Item label="描述">
                      <Text ellipsis type="secondary" style={{ maxWidth: 160 }}>
                        {recipe.description}
                      </Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        製程參數管理
      </Title>

      <style>{`
        .process-oos-row {
          background-color: #fff1f0 !important;
        }
        .process-oos-row:hover > td {
          background-color: #ffccc7 !important;
        }
      `}</style>

      <Tabs
        defaultActiveKey="runs"
        items={[
          {
            key: 'runs',
            label: '量測記錄',
            children: runsTab,
          },
          {
            key: 'recipes',
            label: '配方管理',
            children: recipesTab,
          },
        ]}
      />

      {/* Run Form Modal */}
      <ProcessRunForm
        open={runFormOpen}
        onClose={() => setRunFormOpen(false)}
        onSuccess={() => {
          loadRuns(1)
          getRecipes().then(setAllRecipes).catch(() => {})
        }}
      />

      {/* Recipe Form Modal */}
      <RecipeForm
        open={recipeFormOpen}
        recipe={editingRecipe}
        onClose={() => setRecipeFormOpen(false)}
        onSuccess={() => {
          loadRecipes()
          getRecipes().then(setAllRecipes).catch(() => {})
        }}
      />

      {/* Run Detail Drawer */}
      <ProcessRunDetail
        runId={selectedRunId}
        open={runDetailOpen}
        onClose={() => setRunDetailOpen(false)}
      />

      {/* CSV Import Modal */}
      <Modal
        title="匯入 CSV 量測記錄"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false)
          setImportFileList([])
        }}
        onOk={handleImport}
        okText="開始匯入"
        cancelText="取消"
        confirmLoading={importing}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            CSV 格式：第一行為標題列，欄位包含 lot_id、run_date (YYYY-MM-DD)、recipe_name，以及各參數名稱。
          </Text>
          <Button
            icon={<DownloadOutlined />}
            onClick={downloadCsvTemplate}
            size="small"
          >
            下載範本
          </Button>
          <Upload
            accept=".csv"
            fileList={importFileList}
            beforeUpload={(file) => {
              setImportFileList([file as unknown as UploadFile])
              return false
            }}
            onRemove={() => setImportFileList([])}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>選擇 CSV 檔案</Button>
          </Upload>
        </Space>
      </Modal>

      {/* Parameter Drawer */}
      <Drawer
        title={paramRecipe ? `配方參數：${paramRecipe.name}` : '配方參數'}
        open={paramDrawerOpen}
        onClose={() => setParamDrawerOpen(false)}
        width={680}
      >
        {paramLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>載入中...</div>
        ) : paramRecipe && paramRecipe.parameters.length > 0 ? (
          <Table
            columns={paramColumns}
            dataSource={paramRecipe.parameters}
            rowKey="id"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="此配方尚無參數" />
        )}
      </Drawer>
    </div>
  )
}
