import apiClient from './client'
import type { Token, User, LoginRequest } from '../types'

export const authApi = {
  login: async (credentials: LoginRequest): Promise<Token> => {
    const response = await apiClient.post<Token>('/auth/login', credentials)
    return response.data
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  },
}
