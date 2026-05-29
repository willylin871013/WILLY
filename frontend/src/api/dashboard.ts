import apiClient from './client'
import type {
  DashboardSummary,
  RecentAlarm,
  RecentYieldRecord,
  OverduePm,
  YieldTrendDay,
} from '../types'

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiClient.get<DashboardSummary>('/dashboard/summary')
  return res.data
}

export async function getRecentAlarms(limit = 5): Promise<RecentAlarm[]> {
  const res = await apiClient.get<RecentAlarm[]>('/dashboard/recent-alarms', {
    params: { limit },
  })
  return res.data
}

export async function getRecentYield(limit = 10): Promise<RecentYieldRecord[]> {
  const res = await apiClient.get<RecentYieldRecord[]>('/dashboard/recent-yield', {
    params: { limit },
  })
  return res.data
}

export async function getOverduePms(): Promise<OverduePm[]> {
  const res = await apiClient.get<OverduePm[]>('/dashboard/overdue-pms')
  return res.data
}

export async function getYieldTrend7d(params?: {
  product_id?: string
  step_id?: string
}): Promise<YieldTrendDay[]> {
  const cleanParams: Record<string, string> = {}
  if (params?.product_id) cleanParams.product_id = params.product_id
  if (params?.step_id) cleanParams.step_id = params.step_id
  const res = await apiClient.get<YieldTrendDay[]>('/dashboard/yield-trend-7d', {
    params: cleanParams,
  })
  return res.data
}
