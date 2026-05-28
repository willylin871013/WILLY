import apiClient from './client'
import type { User, UserCreate, UserUpdate, UserListResponse } from '../types'

export const usersApi = {
  list: async (params?: {
    skip?: number
    limit?: number
    role?: string
    is_active?: boolean
  }): Promise<UserListResponse> => {
    const response = await apiClient.get<UserListResponse>('/users', { params })
    return response.data
  },

  getById: async (id: number): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`)
    return response.data
  },

  create: async (data: UserCreate): Promise<User> => {
    const response = await apiClient.post<User>('/users', data)
    return response.data
  },

  update: async (id: number, data: UserUpdate): Promise<User> => {
    const response = await apiClient.put<User>(`/users/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/users/${id}`)
  },
}
