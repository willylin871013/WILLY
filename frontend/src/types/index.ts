export type Role = 'admin' | 'engineer' | 'readonly'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Token {
  access_token: string
  token_type: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface UserCreate {
  email: string
  full_name: string
  password: string
  role: Role
  is_active: boolean
}

export interface UserUpdate {
  email?: string
  full_name?: string
  password?: string
  role?: Role
  is_active?: boolean
}

export interface UserListResponse {
  total: number
  items: User[]
}

export interface ApiError {
  detail: string
}

// ---------------------------------------------------------------------------
// SOP Knowledge Base types
// ---------------------------------------------------------------------------

export interface SopCategory {
  id: string
  name: string
  description?: string
  created_at: string
  doc_count?: number
}

export interface SopTag {
  id: string
  name: string
}

export interface SopVersion {
  id: string
  document_id: string
  version: string
  file_name?: string
  change_notes?: string
  created_at: string
  creator_name?: string
}

export interface SopDocument {
  id: string
  title: string
  description?: string
  content?: string
  category?: SopCategory
  tags: SopTag[]
  version: string
  file_name?: string
  file_size?: number
  creator_name: string
  created_at: string
  updated_at: string
  is_active: boolean
  versions?: SopVersion[]
}

export interface SopDocumentCreate {
  title: string
  description?: string
  content?: string
  category_id?: string
  tags?: string[]
}

export interface SopDocumentUpdate {
  title?: string
  description?: string
  content?: string
  category_id?: string
  tags?: string[]
}

export interface SopListResponse {
  items: SopDocument[]
  total: number
  page: number
  size: number
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Process Parameter Management types (Phase 3)
// ---------------------------------------------------------------------------

export type ProcessType = 'CVD' | 'Etch' | 'CMP' | 'Diffusion' | 'PVD' | 'Lithography' | 'Other'

export interface ProcessParameter {
  id: string
  recipe_id: string
  name: string
  unit?: string
  spec_min?: number
  spec_max?: number
  target?: number
  display_order: number
}

export interface ProcessRecipe {
  id: string
  name: string
  description?: string
  process_type: ProcessType
  parameters: ProcessParameter[]
  creator_name: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface ProcessRecipeListItem {
  id: string
  name: string
  description?: string
  process_type: ProcessType
  parameter_count: number
  creator_name: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface ProcessMeasurement {
  id: string
  parameter_id: string
  parameter_name: string
  unit?: string
  spec_min?: number
  spec_max?: number
  target?: number
  value: number
  is_out_of_spec: boolean
}

export interface ProcessRun {
  id: string
  recipe_id: string
  recipe_name: string
  lot_id: string
  run_date: string
  operator_name?: string
  notes?: string
  measurements: ProcessMeasurement[]
  out_of_spec_count: number
  created_at: string
}

export interface ProcessRunListItem {
  id: string
  recipe_id: string
  recipe_name: string
  lot_id: string
  run_date: string
  operator_name?: string
  notes?: string
  out_of_spec_count: number
  created_at: string
}

export interface ProcessRunListResponse {
  items: ProcessRunListItem[]
  total: number
  page: number
  size: number
}

export interface TrendPoint {
  run_id: string
  lot_id: string
  run_date: string
  value: number
  is_out_of_spec: boolean
}

export interface BulkImportResult {
  success_count: number
  error_count: number
  errors: string[]
}

export interface MeasurementInput {
  parameter_id: string
  value: number | string
}

export interface RunCreate {
  recipe_id: string
  lot_id: string
  run_date: string
  operator_id?: number
  notes?: string
  measurements: MeasurementInput[]
}

export interface RecipeCreate {
  name: string
  description?: string
  process_type: string
  parameters: {
    name: string
    unit?: string
    spec_min?: number
    spec_max?: number
    target?: number
    display_order: number
  }[]
}

export interface RecipeUpdate {
  name?: string
  description?: string
  process_type?: string
  is_active?: boolean
}
