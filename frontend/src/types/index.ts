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

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}
