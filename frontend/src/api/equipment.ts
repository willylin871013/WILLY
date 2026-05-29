import apiClient from './client'
import type {
  Equipment,
  AlarmRecord,
  AlarmListResponse,
  MaintenanceRecord,
  MaintenanceListResponse,
  PmSchedule,
  EquipmentStats,
  GlobalEquipmentStats,
  EquipmentCreate,
  AlarmCreate,
  AlarmUpdate,
  MaintenanceCreate,
  PmScheduleCreate,
  PmCompleteRequest,
} from '../types'

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export async function getEquipmentList(params?: {
  status?: string
  search?: string
}): Promise<Equipment[]> {
  const cleanParams: Record<string, string> = {}
  if (params?.status) cleanParams.status = params.status
  if (params?.search) cleanParams.search = params.search
  const res = await apiClient.get<Equipment[]>('/equipment', { params: cleanParams })
  return res.data
}

export async function createEquipment(payload: EquipmentCreate): Promise<Equipment> {
  const res = await apiClient.post<Equipment>('/equipment', payload)
  return res.data
}

export async function getEquipmentDetail(id: string): Promise<Equipment> {
  const res = await apiClient.get<Equipment>(`/equipment/${id}`)
  return res.data
}

export async function updateEquipment(
  id: string,
  payload: Partial<EquipmentCreate> & { is_active?: boolean }
): Promise<Equipment> {
  const res = await apiClient.put<Equipment>(`/equipment/${id}`, payload)
  return res.data
}

export async function getEquipmentStats(id: string): Promise<EquipmentStats> {
  const res = await apiClient.get<EquipmentStats>(`/equipment/${id}/stats`)
  return res.data
}

export async function getGlobalEquipmentStats(): Promise<GlobalEquipmentStats> {
  const res = await apiClient.get<GlobalEquipmentStats>('/equipment/stats')
  return res.data
}

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

export interface GetAlarmsParams {
  page?: number
  size?: number
  equipment_id?: string
  severity?: string
  is_resolved?: boolean
  start_date?: string
  end_date?: string
  search?: string
}

export async function getAlarms(params: GetAlarmsParams = {}): Promise<AlarmListResponse> {
  const cleanParams: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      cleanParams[k] = v as string | number | boolean
    }
  }
  const res = await apiClient.get<AlarmListResponse>('/equipment/alarms/list', {
    params: cleanParams,
  })
  return res.data
}

export async function createAlarm(payload: AlarmCreate): Promise<AlarmRecord> {
  const res = await apiClient.post<AlarmRecord>('/equipment/alarms', payload)
  return res.data
}

export async function getAlarm(id: string): Promise<AlarmRecord> {
  const res = await apiClient.get<AlarmRecord>(`/equipment/alarms/${id}`)
  return res.data
}

export async function updateAlarm(id: string, payload: AlarmUpdate): Promise<AlarmRecord> {
  const res = await apiClient.put<AlarmRecord>(`/equipment/alarms/${id}`, payload)
  return res.data
}

export async function deleteAlarm(id: string): Promise<void> {
  await apiClient.delete(`/equipment/alarms/${id}`)
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export interface GetMaintenanceParams {
  page?: number
  size?: number
  equipment_id?: string
  maintenance_type?: string
  start_date?: string
  end_date?: string
}

export async function getMaintenanceList(
  params: GetMaintenanceParams = {}
): Promise<MaintenanceListResponse> {
  const cleanParams: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      cleanParams[k] = v as string | number
    }
  }
  const res = await apiClient.get<MaintenanceListResponse>('/equipment/maintenance/list', {
    params: cleanParams,
  })
  return res.data
}

export async function createMaintenance(payload: MaintenanceCreate): Promise<MaintenanceRecord> {
  const res = await apiClient.post<MaintenanceRecord>('/equipment/maintenance', payload)
  return res.data
}

export async function getMaintenance(id: string): Promise<MaintenanceRecord> {
  const res = await apiClient.get<MaintenanceRecord>(`/equipment/maintenance/${id}`)
  return res.data
}

export async function updateMaintenance(
  id: string,
  payload: Partial<MaintenanceCreate>
): Promise<MaintenanceRecord> {
  const res = await apiClient.put<MaintenanceRecord>(`/equipment/maintenance/${id}`, payload)
  return res.data
}

export async function deleteMaintenance(id: string): Promise<void> {
  await apiClient.delete(`/equipment/maintenance/${id}`)
}

// ---------------------------------------------------------------------------
// PM Schedules
// ---------------------------------------------------------------------------

export interface GetPmSchedulesParams {
  equipment_id?: string
  is_overdue?: boolean
  upcoming?: boolean
}

export async function getPmSchedules(
  params: GetPmSchedulesParams = {}
): Promise<PmSchedule[]> {
  const cleanParams: Record<string, string | boolean> = {}
  if (params.equipment_id) cleanParams.equipment_id = params.equipment_id
  if (params.is_overdue !== undefined) cleanParams.is_overdue = params.is_overdue
  if (params.upcoming !== undefined) cleanParams.upcoming = params.upcoming
  const res = await apiClient.get<PmSchedule[]>('/equipment/pm-schedules/list', {
    params: cleanParams,
  })
  return res.data
}

export async function createPmSchedule(payload: PmScheduleCreate): Promise<PmSchedule> {
  const res = await apiClient.post<PmSchedule>('/equipment/pm-schedules', payload)
  return res.data
}

export async function updatePmSchedule(
  id: string,
  payload: Partial<PmScheduleCreate> & { is_active?: boolean }
): Promise<PmSchedule> {
  const res = await apiClient.put<PmSchedule>(`/equipment/pm-schedules/${id}`, payload)
  return res.data
}

export async function deletePmSchedule(id: string): Promise<void> {
  await apiClient.delete(`/equipment/pm-schedules/${id}`)
}

export async function completePm(id: string, payload: PmCompleteRequest): Promise<void> {
  await apiClient.post(`/equipment/pm-schedules/${id}/complete`, payload)
}
