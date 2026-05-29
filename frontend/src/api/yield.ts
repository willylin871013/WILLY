import apiClient from './client'
import type {
  YieldProduct,
  YieldStep,
  YieldLossCategory,
  YieldRecord,
  YieldRecordListResponse,
  YieldRecordCreate,
  YieldRecordUpdate,
  YieldProductCreate,
  YieldStepCreate,
  YieldLossCategoryCreate,
  TrendRecord,
  SpcData,
  SummaryStats,
  ParetoItem,
  BulkImportResult,
} from '../types'

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function getYieldProducts(): Promise<YieldProduct[]> {
  const res = await apiClient.get<YieldProduct[]>('/yield/products')
  return res.data
}

export async function createYieldProduct(payload: YieldProductCreate): Promise<YieldProduct> {
  const res = await apiClient.post<YieldProduct>('/yield/products', payload)
  return res.data
}

export async function updateYieldProduct(
  id: string,
  payload: Partial<YieldProductCreate> & { is_active?: boolean }
): Promise<YieldProduct> {
  const res = await apiClient.put<YieldProduct>(`/yield/products/${id}`, payload)
  return res.data
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export async function getYieldSteps(): Promise<YieldStep[]> {
  const res = await apiClient.get<YieldStep[]>('/yield/steps')
  return res.data
}

export async function createYieldStep(payload: YieldStepCreate): Promise<YieldStep> {
  const res = await apiClient.post<YieldStep>('/yield/steps', payload)
  return res.data
}

// ---------------------------------------------------------------------------
// Loss Categories
// ---------------------------------------------------------------------------

export async function getYieldLossCategories(): Promise<YieldLossCategory[]> {
  const res = await apiClient.get<YieldLossCategory[]>('/yield/loss-categories')
  return res.data
}

export async function createYieldLossCategory(
  payload: YieldLossCategoryCreate
): Promise<YieldLossCategory> {
  const res = await apiClient.post<YieldLossCategory>('/yield/loss-categories', payload)
  return res.data
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface GetYieldRecordsParams {
  page?: number
  size?: number
  product_id?: string
  step_id?: string
  lot_id?: string
  start_date?: string
  end_date?: string
  min_yield?: number
  max_yield?: number
}

export async function getYieldRecords(
  params: GetYieldRecordsParams = {}
): Promise<YieldRecordListResponse> {
  const cleanParams: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      cleanParams[k] = v as string | number | boolean
    }
  }
  const res = await apiClient.get<YieldRecordListResponse>('/yield/records', {
    params: cleanParams,
  })
  return res.data
}

export async function getYieldRecord(id: string): Promise<YieldRecord> {
  const res = await apiClient.get<YieldRecord>(`/yield/records/${id}`)
  return res.data
}

export async function createYieldRecord(payload: YieldRecordCreate): Promise<YieldRecord> {
  const res = await apiClient.post<YieldRecord>('/yield/records', payload)
  return res.data
}

export async function updateYieldRecord(
  id: string,
  payload: YieldRecordUpdate
): Promise<YieldRecord> {
  const res = await apiClient.put<YieldRecord>(`/yield/records/${id}`, payload)
  return res.data
}

export async function deleteYieldRecord(id: string): Promise<void> {
  await apiClient.delete(`/yield/records/${id}`)
}

export async function importYieldRecordsCsv(file: File): Promise<BulkImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<BulkImportResult>('/yield/records/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface GetAnalyticsParams {
  product_id: string
  step_id?: string
  start_date?: string
  end_date?: string
  target?: number
}

export async function getYieldTrend(params: GetAnalyticsParams): Promise<TrendRecord[]> {
  const cleanParams: Record<string, string | number> = { product_id: params.product_id }
  if (params.step_id) cleanParams.step_id = params.step_id
  if (params.start_date) cleanParams.start_date = params.start_date
  if (params.end_date) cleanParams.end_date = params.end_date
  const res = await apiClient.get<TrendRecord[]>('/yield/trend', { params: cleanParams })
  return res.data
}

export async function getYieldSpc(params: GetAnalyticsParams): Promise<SpcData> {
  const cleanParams: Record<string, string | number> = { product_id: params.product_id }
  if (params.step_id) cleanParams.step_id = params.step_id
  if (params.start_date) cleanParams.start_date = params.start_date
  if (params.end_date) cleanParams.end_date = params.end_date
  if (params.target !== undefined && params.target !== null)
    cleanParams.target = params.target
  const res = await apiClient.get<SpcData>('/yield/spc', { params: cleanParams })
  return res.data
}

export async function getYieldSummary(params: GetAnalyticsParams): Promise<SummaryStats> {
  const cleanParams: Record<string, string | number> = { product_id: params.product_id }
  if (params.step_id) cleanParams.step_id = params.step_id
  if (params.start_date) cleanParams.start_date = params.start_date
  if (params.end_date) cleanParams.end_date = params.end_date
  if (params.target !== undefined && params.target !== null)
    cleanParams.target = params.target
  const res = await apiClient.get<SummaryStats>('/yield/summary', { params: cleanParams })
  return res.data
}

export async function getYieldPareto(
  params: Omit<GetAnalyticsParams, 'target'>
): Promise<ParetoItem[]> {
  const cleanParams: Record<string, string | number> = { product_id: params.product_id }
  if (params.step_id) cleanParams.step_id = params.step_id
  if (params.start_date) cleanParams.start_date = params.start_date
  if (params.end_date) cleanParams.end_date = params.end_date
  const res = await apiClient.get<ParetoItem[]>('/yield/pareto', { params: cleanParams })
  return res.data
}
