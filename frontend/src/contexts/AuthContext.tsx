import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { message } from 'antd'
import { authApi } from '../api/auth'
import type { User, LoginRequest } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('access_token'),
  )
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    setToken(null)
    setUser(null)
  }, [])

  // On mount, if we have a stored token, fetch current user
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token')
    if (!storedToken) {
      setIsLoading(false)
      return
    }

    authApi
      .getMe()
      .then((userData) => {
        setUser(userData)
        setToken(storedToken)
      })
      .catch(() => {
        // Token is invalid or expired
        logout()
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [logout])

  const login = useCallback(async (credentials: LoginRequest) => {
    const tokenData = await authApi.login(credentials)
    localStorage.setItem('access_token', tokenData.access_token)
    setToken(tokenData.access_token)

    // Fetch user profile after login
    const userData = await authApi.getMe()
    setUser(userData)
    message.success(`歡迎回來，${userData.full_name}！`)
  }, [])

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
