import apiClient from './client'
import type {
  ProcessRecipe,
  ProcessRecipeListItem,
  ProcessRun,
  ProcessRunListResponse,
  TrendPoint,
  BulkImportResult,
  RunCreate,
  RecipeCreate,
  RecipeUpdate,
  ProcessParameter,
} from '../types'

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export interface GetRecipesParams {
  process_type?: string
  search?: string
}

export async function getRecipes(params: GetRecipesParams = {}): Promise<ProcessRecipeListItem[]> {
  const res = await apiClient.get<ProcessRecipeListItem[]>('/process/recipes', { params })
  return res.data
}

export async function getRecipe(id: string): Promise<ProcessRecipe> {
  const res = await apiClient.get<ProcessRecipe>(`/process/recipes/${id}`)
  return res.data
}

export async function createRecipe(payload: RecipeCreate): Promise<ProcessRecipe> {
  const res = await apiClient.post<ProcessRecipe>('/process/recipes', payload)
  return res.data
}

export async function updateRecipe(id: string, payload: RecipeUpdate): Promise<ProcessRecipe> {
  const res = await apiClient.put<ProcessRecipe>(`/process/recipes/${id}`, payload)
  return res.data
}

export async function deleteRecipe(id: string): Promise<void> {
  await apiClient.delete(`/process/recipes/${id}`)
}

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export interface ParameterCreate {
  name: string
  unit?: string
  spec_min?: number
  spec_max?: number
  target?: number
  display_order?: number
}

export interface ParameterUpdate {
  name?: string
  unit?: string
  spec_min?: number
  spec_max?: number
  target?: number
  display_order?: number
}

export async function addParameter(recipeId: string, payload: ParameterCreate): Promise<ProcessParameter> {
  const res = await apiClient.post<ProcessParameter>(`/process/recipes/${recipeId}/parameters`, payload)
  return res.data
}

export async function updateParameter(parameterId: string, payload: ParameterUpdate): Promise<ProcessParameter> {
  const res = await apiClient.put<ProcessParameter>(`/process/parameters/${parameterId}`, payload)
  return res.data
}

export async function deleteParameter(parameterId: string): Promise<void> {
  await apiClient.delete(`/process/parameters/${parameterId}`)
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export interface GetRunsParams {
  page?: number
  size?: number
  recipe_id?: string
  lot_id?: string
  start_date?: string
  end_date?: string
  has_out_of_spec?: boolean
}

export async function getRuns(params: GetRunsParams = {}): Promise<ProcessRunListResponse> {
  const cleanParams: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      cleanParams[k] = v as string | number | boolean
    }
  }
  const res = await apiClient.get<ProcessRunListResponse>('/process/runs', { params: cleanParams })
  return res.data
}

export async function getRun(id: string): Promise<ProcessRun> {
  const res = await apiClient.get<ProcessRun>(`/process/runs/${id}`)
  return res.data
}

export async function createRun(payload: RunCreate): Promise<ProcessRun> {
  const res = await apiClient.post<ProcessRun>('/process/runs', payload)
  return res.data
}

export async function updateRun(id: string, payload: { notes?: string; operator_id?: number }): Promise<ProcessRun> {
  const res = await apiClient.put<ProcessRun>(`/process/runs/${id}`, payload)
  return res.data
}

export async function deleteRun(id: string): Promise<void> {
  await apiClient.delete(`/process/runs/${id}`)
}

// ---------------------------------------------------------------------------
// CSV Import
// ---------------------------------------------------------------------------

export async function importRunsCsv(file: File): Promise<BulkImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<BulkImportResult>('/process/runs/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ---------------------------------------------------------------------------
// Trend data
// ---------------------------------------------------------------------------

export interface GetTrendParams {
  recipe_id: string
  parameter_id: string
  start_date?: string
  end_date?: string
  limit?: number
}

export async function getTrend(params: GetTrendParams): Promise<TrendPoint[]> {
  const res = await apiClient.get<TrendPoint[]>('/process/runs/trend', { params })
  return res.data
}
