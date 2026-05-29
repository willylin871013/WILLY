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
