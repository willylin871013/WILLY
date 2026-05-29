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

// ---------------------------------------------------------------------------
// Yield Analysis types (Phase 4)
// ---------------------------------------------------------------------------

export interface YieldProduct {
  id: string
  name: string
  product_code: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface YieldStep {
  id: string
  name: string
  sequence_order: number
  description?: string
}

export interface YieldLossCategory {
  id: string
  name: string
  color: string
  description?: string
}

export interface YieldLossRecord {
  id: string
  category_id: string
  category_name: string
  color: string
  loss_pct: number
  notes?: string
}

export interface YieldRecord {
  id: string
  lot_id: string
  product_id: string
  product_name: string
  product_code: string
  step_id: string
  step_name: string
  measurement_date: string
  yield_pct: number
  wafer_in?: number
  wafer_out?: number
  die_per_wafer?: number
  good_die?: number
  notes?: string
  loss_records: YieldLossRecord[]
  creator_name: string
  created_at: string
}

export interface YieldRecordListResponse {
  items: YieldRecord[]
  total: number
  page: number
  size: number
}

export interface TrendRecord {
  record_id: string
  lot_id: string
  date: string
  yield_pct: number
}

export interface SpcPoint {
  lot_id: string
  date: string
  value: number
  mr?: number
  out_of_control: boolean
}

export interface SpcData {
  points: SpcPoint[]
  mean: number
  std: number
  ucl: number
  lcl: number
  mr_ucl: number
  cp?: number
  cpk?: number
}

export interface SummaryStats {
  count: number
  mean: number
  std: number
  min: number
  max: number
  p25: number
  p50: number
  p75: number
  cp?: number
  cpk?: number
  yield_target?: number
}

export interface ParetoItem {
  category_name: string
  color: string
  total_loss_pct: number
  record_count: number
}

export interface YieldRecordCreate {
  lot_id: string
  product_id: string
  step_id: string
  measurement_date: string
  yield_pct: number
  wafer_in?: number
  wafer_out?: number
  die_per_wafer?: number
  good_die?: number
  notes?: string
  loss_records: { category_id: string; loss_pct: number; notes?: string }[]
}

export interface YieldRecordUpdate {
  lot_id?: string
  measurement_date?: string
  yield_pct?: number
  wafer_in?: number
  wafer_out?: number
  die_per_wafer?: number
  good_die?: number
  notes?: string
}

export interface YieldProductCreate {
  name: string
  product_code: string
  description?: string
}

export interface YieldStepCreate {
  name: string
  sequence_order?: number
  description?: string
}

export interface YieldLossCategoryCreate {
  name: string
  color?: string
  description?: string
}

// ---------------------------------------------------------------------------
// Equipment Management types (Phase 5)
// ---------------------------------------------------------------------------

export type EquipmentStatus = 'normal' | 'alarm' | 'down' | 'maintenance' | 'pm'
export type AlarmSeverity = 'low' | 'medium' | 'high' | 'critical'
export type MaintenanceType = 'repair' | 'pm' | 'calibration' | 'inspection'

export interface Equipment {
  id: string
  name: string
  equipment_id: string
  equipment_type: string
  location?: string
  status: EquipmentStatus
  description?: string
  is_active: boolean
  created_at: string
  alarm_count: number
  recent_alarms: AlarmRecordBrief[]
}

export interface AlarmRecordBrief {
  id: string
  title: string
  severity: AlarmSeverity
  occurred_at: string
  resolved_at?: string
}

export interface AlarmRecord {
  id: string
  equipment_id: string
  equipment_name: string
  alarm_code?: string
  alarm_type?: string
  severity: AlarmSeverity
  title: string
  description: string
  occurred_at: string
  resolved_at?: string
  downtime_minutes?: number
  root_cause?: string
  corrective_action?: string
  reported_by_name: string
  resolved_by_name?: string
  created_at: string
}

export interface AlarmListResponse {
  items: AlarmRecord[]
  total: number
  page: number
  size: number
}

export interface MaintenanceRecord {
  id: string
  equipment_id: string
  equipment_name: string
  maintenance_type: MaintenanceType
  title: string
  description: string
  start_time: string
  end_time?: string
  engineer_name?: string
  parts_replaced?: string
  cost?: number
  result?: string
  created_at: string
}

export interface MaintenanceListResponse {
  items: MaintenanceRecord[]
  total: number
  page: number
  size: number
}

export interface PmSchedule {
  id: string
  equipment_id: string
  equipment_name: string
  pm_name: string
  interval_days: number
  last_pm_date?: string
  next_pm_date?: string
  estimated_duration_hours?: number
  procedure_notes?: string
  days_until_pm: number
  is_overdue: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EquipmentStats {
  total_alarms_30d: number
  critical_alarms_30d: number
  total_downtime_hours_30d: number
  upcoming_pms: number
  overdue_pms: number
}

export interface GlobalEquipmentStats {
  total_equipment: number
  normal_count: number
  alarm_count: number
  down_count: number
  maintenance_count: number
  pm_count: number
  total_alarms_30d: number
  critical_alarms_30d: number
  total_downtime_hours_30d: number
  upcoming_pms: number
  overdue_pms: number
}

export interface EquipmentCreate {
  name: string
  equipment_id: string
  equipment_type: string
  location?: string
  status?: EquipmentStatus
  description?: string
}

export interface AlarmCreate {
  equipment_id: string
  alarm_code?: string
  alarm_type?: string
  severity: AlarmSeverity
  title: string
  description: string
  occurred_at: string
  downtime_minutes?: number
}

export interface AlarmUpdate {
  alarm_code?: string
  alarm_type?: string
  severity?: AlarmSeverity
  title?: string
  description?: string
  occurred_at?: string
  resolved_at?: string
  downtime_minutes?: number
  root_cause?: string
  corrective_action?: string
  resolved_by?: number
}

export interface MaintenanceCreate {
  equipment_id: string
  maintenance_type: MaintenanceType
  title: string
  description: string
  start_time: string
  end_time?: string
  engineer_id?: number
  parts_replaced?: string
  cost?: number
  result?: string
}

export interface PmScheduleCreate {
  equipment_id: string
  pm_name: string
  interval_days: number
  last_pm_date?: string
  estimated_duration_hours?: number
  procedure_notes?: string
}

export interface PmCompleteRequest {
  completed_date: string
  notes?: string
  maintenance_record_id?: string
}

// ---------------------------------------------------------------------------
// Dashboard types (Phase 6)
// ---------------------------------------------------------------------------

export interface DashboardYieldStats {
  avg_7d: number
  avg_30d: number
  records_30d: number
  below_90_count: number
}

export interface DashboardEquipmentStats {
  total: number
  normal: number
  alarm_or_down: number
  alarms_24h: number
  critical_alarms_7d: number
  downtime_hours_7d: number
  overdue_pms: number
  upcoming_pms_7d: number
}

export interface DashboardProcessStats {
  runs_7d: number
  out_of_spec_runs_7d: number
}

export interface DashboardSopStats {
  total_docs: number
  updated_7d: number
}

export interface DashboardSummary {
  yield: DashboardYieldStats
  equipment: DashboardEquipmentStats
  process: DashboardProcessStats
  sop: DashboardSopStats
}

export interface RecentAlarm {
  id: string
  equipment_name: string
  severity: AlarmSeverity
  title: string
  occurred_at: string
}

export interface RecentYieldRecord {
  id: string
  lot_id: string
  product_name: string
  step_name: string
  yield_pct: number
  measurement_date: string
}

export interface OverduePm {
  id: string
  equipment_name: string
  pm_name: string
  next_pm_date: string
  days_overdue: number
}

export interface YieldTrendDay {
  date: string
  avg_yield: number | null
}
