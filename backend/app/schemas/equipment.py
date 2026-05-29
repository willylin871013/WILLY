import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field

from app.models.equipment import EquipmentStatus, AlarmSeverity, MaintenanceType


# ---------------------------------------------------------------------------
# Equipment schemas
# ---------------------------------------------------------------------------

class EquipmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    equipment_id: str = Field(..., min_length=1, max_length=100)
    equipment_type: str = Field(..., min_length=1, max_length=100)
    location: Optional[str] = None
    status: EquipmentStatus = EquipmentStatus.normal
    description: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    equipment_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[EquipmentStatus] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AlarmRecordBrief(BaseModel):
    id: uuid.UUID
    title: str
    severity: AlarmSeverity
    occurred_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EquipmentRead(BaseModel):
    id: uuid.UUID
    name: str
    equipment_id: str
    equipment_type: str
    location: Optional[str] = None
    status: EquipmentStatus
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    alarm_count: int = 0
    recent_alarms: list[AlarmRecordBrief] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# AlarmRecord schemas
# ---------------------------------------------------------------------------

class AlarmCreate(BaseModel):
    equipment_id: uuid.UUID
    alarm_code: Optional[str] = None
    alarm_type: Optional[str] = None
    severity: AlarmSeverity = AlarmSeverity.medium
    title: str = Field(..., min_length=1, max_length=300)
    description: str
    occurred_at: datetime
    downtime_minutes: Optional[int] = None


class AlarmUpdate(BaseModel):
    alarm_code: Optional[str] = None
    alarm_type: Optional[str] = None
    severity: Optional[AlarmSeverity] = None
    title: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    downtime_minutes: Optional[int] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    resolved_by: Optional[int] = None


class AlarmRead(BaseModel):
    id: uuid.UUID
    equipment_id: uuid.UUID
    equipment_name: str
    alarm_code: Optional[str] = None
    alarm_type: Optional[str] = None
    severity: AlarmSeverity
    title: str
    description: str
    occurred_at: datetime
    resolved_at: Optional[datetime] = None
    downtime_minutes: Optional[int] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    reported_by_name: str
    resolved_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AlarmListResponse(BaseModel):
    items: list[AlarmRead]
    total: int
    page: int
    size: int


# ---------------------------------------------------------------------------
# MaintenanceRecord schemas
# ---------------------------------------------------------------------------

class MaintenanceCreate(BaseModel):
    equipment_id: uuid.UUID
    maintenance_type: MaintenanceType
    title: str = Field(..., min_length=1, max_length=300)
    description: str
    start_time: datetime
    end_time: Optional[datetime] = None
    engineer_id: Optional[int] = None
    parts_replaced: Optional[str] = None
    cost: Optional[float] = None
    result: Optional[str] = None


class MaintenanceUpdate(BaseModel):
    maintenance_type: Optional[MaintenanceType] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    engineer_id: Optional[int] = None
    parts_replaced: Optional[str] = None
    cost: Optional[float] = None
    result: Optional[str] = None


class MaintenanceRead(BaseModel):
    id: uuid.UUID
    equipment_id: uuid.UUID
    equipment_name: str
    maintenance_type: MaintenanceType
    title: str
    description: str
    start_time: datetime
    end_time: Optional[datetime] = None
    engineer_name: Optional[str] = None
    parts_replaced: Optional[str] = None
    cost: Optional[float] = None
    result: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MaintenanceListResponse(BaseModel):
    items: list[MaintenanceRead]
    total: int
    page: int
    size: int


# ---------------------------------------------------------------------------
# PmSchedule schemas
# ---------------------------------------------------------------------------

class PmScheduleCreate(BaseModel):
    equipment_id: uuid.UUID
    pm_name: str = Field(..., min_length=1, max_length=200)
    interval_days: int = Field(..., ge=1)
    last_pm_date: Optional[date] = None
    estimated_duration_hours: Optional[float] = None
    procedure_notes: Optional[str] = None


class PmScheduleUpdate(BaseModel):
    pm_name: Optional[str] = None
    interval_days: Optional[int] = None
    last_pm_date: Optional[date] = None
    estimated_duration_hours: Optional[float] = None
    procedure_notes: Optional[str] = None
    is_active: Optional[bool] = None


class PmScheduleRead(BaseModel):
    id: uuid.UUID
    equipment_id: uuid.UUID
    equipment_name: str
    pm_name: str
    interval_days: int
    last_pm_date: Optional[date] = None
    next_pm_date: Optional[date] = None
    estimated_duration_hours: Optional[float] = None
    procedure_notes: Optional[str] = None
    is_active: bool
    days_until_pm: int
    is_overdue: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# PmRecord schemas
# ---------------------------------------------------------------------------

class PmRecordCreate(BaseModel):
    schedule_id: uuid.UUID
    maintenance_record_id: Optional[uuid.UUID] = None
    completed_date: date
    notes: Optional[str] = None


class PmCompleteRequest(BaseModel):
    completed_date: date
    notes: Optional[str] = None
    maintenance_record_id: Optional[uuid.UUID] = None


class PmRecordRead(BaseModel):
    id: uuid.UUID
    schedule_id: uuid.UUID
    maintenance_record_id: Optional[uuid.UUID] = None
    completed_date: date
    completed_by: int
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Stats schema
# ---------------------------------------------------------------------------

class EquipmentStats(BaseModel):
    total_alarms_30d: int
    critical_alarms_30d: int
    total_downtime_hours_30d: float
    upcoming_pms: int
    overdue_pms: int


class GlobalStats(BaseModel):
    total_equipment: int
    normal_count: int
    alarm_count: int
    down_count: int
    maintenance_count: int
    pm_count: int
    total_alarms_30d: int
    critical_alarms_30d: int
    total_downtime_hours_30d: float
    upcoming_pms: int
    overdue_pms: int
