import uuid
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.deps import get_current_user
from app.models.equipment import (
    Equipment, AlarmRecord, MaintenanceRecord, PmSchedule, PmRecord,
    EquipmentStatus, AlarmSeverity, MaintenanceType,
)
from app.models.user import User, UserRole
from app.schemas.equipment import (
    EquipmentCreate, EquipmentRead, EquipmentUpdate, AlarmRecordBrief,
    AlarmCreate, AlarmRead, AlarmUpdate, AlarmListResponse,
    MaintenanceCreate, MaintenanceRead, MaintenanceUpdate, MaintenanceListResponse,
    PmScheduleCreate, PmScheduleRead, PmScheduleUpdate,
    PmRecordRead, PmCompleteRequest,
    EquipmentStats, GlobalStats,
)

router = APIRouter(prefix="/equipment", tags=["設備管理"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_next_pm(last_date: Optional[date], created_at: datetime, interval_days: int) -> date:
    base = last_date if last_date is not None else created_at.date()
    return base + timedelta(days=interval_days)


def _alarm_to_read(alarm: AlarmRecord) -> AlarmRead:
    return AlarmRead(
        id=alarm.id,
        equipment_id=alarm.equipment_id,
        equipment_name=alarm.equipment.name if alarm.equipment else "未知",
        alarm_code=alarm.alarm_code,
        alarm_type=alarm.alarm_type,
        severity=alarm.severity,
        title=alarm.title,
        description=alarm.description,
        occurred_at=alarm.occurred_at,
        resolved_at=alarm.resolved_at,
        downtime_minutes=alarm.downtime_minutes,
        root_cause=alarm.root_cause,
        corrective_action=alarm.corrective_action,
        reported_by_name=alarm.reporter.full_name if alarm.reporter else "未知",
        resolved_by_name=alarm.resolver.full_name if alarm.resolver else None,
        created_at=alarm.created_at,
    )


def _maintenance_to_read(rec: MaintenanceRecord) -> MaintenanceRead:
    return MaintenanceRead(
        id=rec.id,
        equipment_id=rec.equipment_id,
        equipment_name=rec.equipment.name if rec.equipment else "未知",
        maintenance_type=rec.maintenance_type,
        title=rec.title,
        description=rec.description,
        start_time=rec.start_time,
        end_time=rec.end_time,
        engineer_name=rec.engineer.full_name if rec.engineer else None,
        parts_replaced=rec.parts_replaced,
        cost=rec.cost,
        result=rec.result,
        created_at=rec.created_at,
    )


def _pm_schedule_to_read(sched: PmSchedule) -> PmScheduleRead:
    today = date.today()
    next_pm = sched.next_pm_date
    if next_pm is None:
        next_pm = _compute_next_pm(sched.last_pm_date, sched.created_at, sched.interval_days)
    days_until = (next_pm - today).days
    is_overdue = days_until < 0
    return PmScheduleRead(
        id=sched.id,
        equipment_id=sched.equipment_id,
        equipment_name=sched.equipment.name if sched.equipment else "未知",
        pm_name=sched.pm_name,
        interval_days=sched.interval_days,
        last_pm_date=sched.last_pm_date,
        next_pm_date=next_pm,
        estimated_duration_hours=sched.estimated_duration_hours,
        procedure_notes=sched.procedure_notes,
        is_active=sched.is_active,
        days_until_pm=days_until,
        is_overdue=is_overdue,
        created_at=sched.created_at,
        updated_at=sched.updated_at,
    )


async def _load_alarm(db: AsyncSession, alarm_id: uuid.UUID) -> Optional[AlarmRecord]:
    result = await db.execute(
        select(AlarmRecord)
        .options(
            selectinload(AlarmRecord.equipment),
            selectinload(AlarmRecord.reporter),
            selectinload(AlarmRecord.resolver),
        )
        .where(AlarmRecord.id == alarm_id)
    )
    return result.scalar_one_or_none()


async def _load_maintenance(db: AsyncSession, rec_id: uuid.UUID) -> Optional[MaintenanceRecord]:
    result = await db.execute(
        select(MaintenanceRecord)
        .options(
            selectinload(MaintenanceRecord.equipment),
            selectinload(MaintenanceRecord.engineer),
            selectinload(MaintenanceRecord.creator),
        )
        .where(MaintenanceRecord.id == rec_id)
    )
    return result.scalar_one_or_none()


async def _load_pm_schedule(db: AsyncSession, sched_id: uuid.UUID) -> Optional[PmSchedule]:
    result = await db.execute(
        select(PmSchedule)
        .options(selectinload(PmSchedule.equipment))
        .where(PmSchedule.id == sched_id)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Equipment endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[EquipmentRead])
async def list_equipment(
    status: Optional[EquipmentStatus] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出設備（可依狀態篩選、搜尋名稱/設備編號）"""
    stmt = select(Equipment).where(Equipment.is_active == True)
    if status:
        stmt = stmt.where(Equipment.status == status)
    if search:
        stmt = stmt.where(
            or_(
                Equipment.name.ilike(f"%{search}%"),
                Equipment.equipment_id.ilike(f"%{search}%"),
            )
        )
    stmt = stmt.order_by(Equipment.name)
    result = await db.execute(stmt)
    equipments = result.scalars().all()

    reads = []
    for eq in equipments:
        # Count alarms in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        count_result = await db.execute(
            select(func.count(AlarmRecord.id)).where(
                AlarmRecord.equipment_id == eq.id,
                AlarmRecord.occurred_at >= thirty_days_ago,
            )
        )
        alarm_count = count_result.scalar_one() or 0

        # Recent 5 alarms
        recent_result = await db.execute(
            select(AlarmRecord)
            .where(AlarmRecord.equipment_id == eq.id)
            .order_by(AlarmRecord.occurred_at.desc())
            .limit(5)
        )
        recent_alarms = [
            AlarmRecordBrief(
                id=a.id,
                title=a.title,
                severity=a.severity,
                occurred_at=a.occurred_at,
                resolved_at=a.resolved_at,
            )
            for a in recent_result.scalars().all()
        ]

        reads.append(EquipmentRead(
            id=eq.id,
            name=eq.name,
            equipment_id=eq.equipment_id,
            equipment_type=eq.equipment_type,
            location=eq.location,
            status=eq.status,
            description=eq.description,
            is_active=eq.is_active,
            created_at=eq.created_at,
            alarm_count=alarm_count,
            recent_alarms=recent_alarms,
        ))
    return reads


@router.post("", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    payload: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增設備（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    dup = await db.execute(select(Equipment).where(Equipment.equipment_id == payload.equipment_id))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="設備編號已存在")

    eq = Equipment(
        name=payload.name,
        equipment_id=payload.equipment_id,
        equipment_type=payload.equipment_type,
        location=payload.location,
        status=payload.status,
        description=payload.description,
    )
    db.add(eq)
    await db.commit()
    await db.refresh(eq)
    return EquipmentRead(
        id=eq.id,
        name=eq.name,
        equipment_id=eq.equipment_id,
        equipment_type=eq.equipment_type,
        location=eq.location,
        status=eq.status,
        description=eq.description,
        is_active=eq.is_active,
        created_at=eq.created_at,
        alarm_count=0,
        recent_alarms=[],
    )


@router.get("/stats", response_model=GlobalStats)
async def get_global_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """全域統計（儀表板用）"""
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    today = date.today()

    total_eq = await db.execute(select(func.count(Equipment.id)).where(Equipment.is_active == True))
    total_equipment = total_eq.scalar_one() or 0

    normal_res = await db.execute(
        select(func.count(Equipment.id)).where(Equipment.status == EquipmentStatus.normal, Equipment.is_active == True)
    )
    alarm_res = await db.execute(
        select(func.count(Equipment.id)).where(Equipment.status == EquipmentStatus.alarm, Equipment.is_active == True)
    )
    down_res = await db.execute(
        select(func.count(Equipment.id)).where(Equipment.status == EquipmentStatus.down, Equipment.is_active == True)
    )
    maint_res = await db.execute(
        select(func.count(Equipment.id)).where(Equipment.status == EquipmentStatus.maintenance, Equipment.is_active == True)
    )
    pm_res = await db.execute(
        select(func.count(Equipment.id)).where(Equipment.status == EquipmentStatus.pm, Equipment.is_active == True)
    )

    total_alarms_res = await db.execute(
        select(func.count(AlarmRecord.id)).where(AlarmRecord.occurred_at >= thirty_days_ago)
    )
    critical_res = await db.execute(
        select(func.count(AlarmRecord.id)).where(
            AlarmRecord.occurred_at >= thirty_days_ago,
            AlarmRecord.severity == AlarmSeverity.critical,
        )
    )
    downtime_res = await db.execute(
        select(func.sum(AlarmRecord.downtime_minutes)).where(AlarmRecord.occurred_at >= thirty_days_ago)
    )

    # PM stats
    all_schedules_res = await db.execute(
        select(PmSchedule).options(selectinload(PmSchedule.equipment)).where(PmSchedule.is_active == True)
    )
    all_schedules = all_schedules_res.scalars().all()
    upcoming_pms = 0
    overdue_pms = 0
    for sched in all_schedules:
        next_pm = sched.next_pm_date or _compute_next_pm(sched.last_pm_date, sched.created_at, sched.interval_days)
        days_until = (next_pm - today).days
        if days_until < 0:
            overdue_pms += 1
        elif days_until <= 30:
            upcoming_pms += 1

    downtime_minutes = downtime_res.scalar_one() or 0

    return GlobalStats(
        total_equipment=total_equipment,
        normal_count=normal_res.scalar_one() or 0,
        alarm_count=alarm_res.scalar_one() or 0,
        down_count=down_res.scalar_one() or 0,
        maintenance_count=maint_res.scalar_one() or 0,
        pm_count=pm_res.scalar_one() or 0,
        total_alarms_30d=total_alarms_res.scalar_one() or 0,
        critical_alarms_30d=critical_res.scalar_one() or 0,
        total_downtime_hours_30d=round((downtime_minutes or 0) / 60, 2),
        upcoming_pms=upcoming_pms,
        overdue_pms=overdue_pms,
    )


@router.get("/{equipment_id_path}", response_model=EquipmentRead)
async def get_equipment(
    equipment_id_path: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得設備詳情（含最近5筆告警、維修、PM排程）"""
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id_path))
    eq = result.scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該設備")

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    count_result = await db.execute(
        select(func.count(AlarmRecord.id)).where(
            AlarmRecord.equipment_id == eq.id,
            AlarmRecord.occurred_at >= thirty_days_ago,
        )
    )
    alarm_count = count_result.scalar_one() or 0

    recent_result = await db.execute(
        select(AlarmRecord)
        .where(AlarmRecord.equipment_id == eq.id)
        .order_by(AlarmRecord.occurred_at.desc())
        .limit(5)
    )
    recent_alarms = [
        AlarmRecordBrief(
            id=a.id,
            title=a.title,
            severity=a.severity,
            occurred_at=a.occurred_at,
            resolved_at=a.resolved_at,
        )
        for a in recent_result.scalars().all()
    ]

    return EquipmentRead(
        id=eq.id,
        name=eq.name,
        equipment_id=eq.equipment_id,
        equipment_type=eq.equipment_type,
        location=eq.location,
        status=eq.status,
        description=eq.description,
        is_active=eq.is_active,
        created_at=eq.created_at,
        alarm_count=alarm_count,
        recent_alarms=recent_alarms,
    )


@router.put("/{equipment_id_path}", response_model=EquipmentRead)
async def update_equipment(
    equipment_id_path: uuid.UUID,
    payload: EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新設備資訊（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id_path))
    eq = result.scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該設備")

    if payload.name is not None:
        eq.name = payload.name
    if payload.equipment_type is not None:
        eq.equipment_type = payload.equipment_type
    if payload.location is not None:
        eq.location = payload.location
    if payload.status is not None:
        eq.status = payload.status
    if payload.description is not None:
        eq.description = payload.description
    if payload.is_active is not None:
        eq.is_active = payload.is_active

    await db.commit()
    await db.refresh(eq)

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    count_result = await db.execute(
        select(func.count(AlarmRecord.id)).where(
            AlarmRecord.equipment_id == eq.id,
            AlarmRecord.occurred_at >= thirty_days_ago,
        )
    )
    alarm_count = count_result.scalar_one() or 0

    return EquipmentRead(
        id=eq.id,
        name=eq.name,
        equipment_id=eq.equipment_id,
        equipment_type=eq.equipment_type,
        location=eq.location,
        status=eq.status,
        description=eq.description,
        is_active=eq.is_active,
        created_at=eq.created_at,
        alarm_count=alarm_count,
        recent_alarms=[],
    )


@router.get("/{equipment_id_path}/stats", response_model=EquipmentStats)
async def get_equipment_stats(
    equipment_id_path: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得單台設備統計"""
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id_path))
    eq = result.scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該設備")

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    today = date.today()

    total_alarms_res = await db.execute(
        select(func.count(AlarmRecord.id)).where(
            AlarmRecord.equipment_id == eq.id,
            AlarmRecord.occurred_at >= thirty_days_ago,
        )
    )
    critical_res = await db.execute(
        select(func.count(AlarmRecord.id)).where(
            AlarmRecord.equipment_id == eq.id,
            AlarmRecord.occurred_at >= thirty_days_ago,
            AlarmRecord.severity == AlarmSeverity.critical,
        )
    )
    downtime_res = await db.execute(
        select(func.sum(AlarmRecord.downtime_minutes)).where(
            AlarmRecord.equipment_id == eq.id,
            AlarmRecord.occurred_at >= thirty_days_ago,
        )
    )

    schedules_res = await db.execute(
        select(PmSchedule).where(PmSchedule.equipment_id == eq.id, PmSchedule.is_active == True)
    )
    schedules = schedules_res.scalars().all()
    upcoming_pms = 0
    overdue_pms = 0
    for sched in schedules:
        next_pm = sched.next_pm_date or _compute_next_pm(sched.last_pm_date, sched.created_at, sched.interval_days)
        days_until = (next_pm - today).days
        if days_until < 0:
            overdue_pms += 1
        elif days_until <= 30:
            upcoming_pms += 1

    downtime_minutes = downtime_res.scalar_one() or 0
    return EquipmentStats(
        total_alarms_30d=total_alarms_res.scalar_one() or 0,
        critical_alarms_30d=critical_res.scalar_one() or 0,
        total_downtime_hours_30d=round((downtime_minutes or 0) / 60, 2),
        upcoming_pms=upcoming_pms,
        overdue_pms=overdue_pms,
    )


# ---------------------------------------------------------------------------
# Alarm endpoints
# ---------------------------------------------------------------------------

@router.get("/alarms/list", response_model=AlarmListResponse)
async def list_alarms(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    equipment_id: Optional[uuid.UUID] = Query(None),
    severity: Optional[AlarmSeverity] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出告警記錄（含分頁、篩選）"""
    stmt = select(AlarmRecord)
    if equipment_id:
        stmt = stmt.where(AlarmRecord.equipment_id == equipment_id)
    if severity:
        stmt = stmt.where(AlarmRecord.severity == severity)
    if is_resolved is not None:
        if is_resolved:
            stmt = stmt.where(AlarmRecord.resolved_at.isnot(None))
        else:
            stmt = stmt.where(AlarmRecord.resolved_at.is_(None))
    if start_date:
        stmt = stmt.where(AlarmRecord.occurred_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        stmt = stmt.where(AlarmRecord.occurred_at <= datetime.combine(end_date, datetime.max.time()))
    if search:
        stmt = stmt.where(AlarmRecord.title.ilike(f"%{search}%"))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    offset = (page - 1) * size
    paged = (
        stmt
        .options(
            selectinload(AlarmRecord.equipment),
            selectinload(AlarmRecord.reporter),
            selectinload(AlarmRecord.resolver),
        )
        .order_by(AlarmRecord.occurred_at.desc())
        .offset(offset)
        .limit(size)
    )
    result = await db.execute(paged)
    alarms = result.scalars().all()

    return AlarmListResponse(
        items=[_alarm_to_read(a) for a in alarms],
        total=total,
        page=page,
        size=size,
    )


@router.post("/alarms", response_model=AlarmRead, status_code=status.HTTP_201_CREATED)
async def create_alarm(
    payload: AlarmCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增告警記錄（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    eq_res = await db.execute(select(Equipment).where(Equipment.id == payload.equipment_id))
    if not eq_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該設備")

    alarm = AlarmRecord(
        equipment_id=payload.equipment_id,
        alarm_code=payload.alarm_code,
        alarm_type=payload.alarm_type,
        severity=payload.severity,
        title=payload.title,
        description=payload.description,
        occurred_at=payload.occurred_at,
        downtime_minutes=payload.downtime_minutes,
        reported_by=current_user.id,
    )
    db.add(alarm)
    await db.commit()
    alarm = await _load_alarm(db, alarm.id)
    return _alarm_to_read(alarm)


@router.get("/alarms/{alarm_id}", response_model=AlarmRead)
async def get_alarm(
    alarm_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得告警記錄詳情"""
    alarm = await _load_alarm(db, alarm_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該告警記錄")
    return _alarm_to_read(alarm)


@router.put("/alarms/{alarm_id}", response_model=AlarmRead)
async def update_alarm(
    alarm_id: uuid.UUID,
    payload: AlarmUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新告警記錄（含解除告警）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(AlarmRecord).where(AlarmRecord.id == alarm_id))
    alarm = result.scalar_one_or_none()
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該告警記錄")

    if payload.alarm_code is not None:
        alarm.alarm_code = payload.alarm_code
    if payload.alarm_type is not None:
        alarm.alarm_type = payload.alarm_type
    if payload.severity is not None:
        alarm.severity = payload.severity
    if payload.title is not None:
        alarm.title = payload.title
    if payload.description is not None:
        alarm.description = payload.description
    if payload.occurred_at is not None:
        alarm.occurred_at = payload.occurred_at
    if payload.resolved_at is not None:
        alarm.resolved_at = payload.resolved_at
        alarm.resolved_by = payload.resolved_by or current_user.id
    if payload.downtime_minutes is not None:
        alarm.downtime_minutes = payload.downtime_minutes
    if payload.root_cause is not None:
        alarm.root_cause = payload.root_cause
    if payload.corrective_action is not None:
        alarm.corrective_action = payload.corrective_action

    await db.commit()
    alarm = await _load_alarm(db, alarm_id)
    return _alarm_to_read(alarm)


@router.delete("/alarms/{alarm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alarm(
    alarm_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """刪除告警記錄（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除記錄")

    result = await db.execute(select(AlarmRecord).where(AlarmRecord.id == alarm_id))
    alarm = result.scalar_one_or_none()
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該告警記錄")

    await db.delete(alarm)
    await db.commit()


# ---------------------------------------------------------------------------
# Maintenance endpoints
# ---------------------------------------------------------------------------

@router.get("/maintenance/list", response_model=MaintenanceListResponse)
async def list_maintenance(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    equipment_id: Optional[uuid.UUID] = Query(None),
    maintenance_type: Optional[MaintenanceType] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出維修記錄（含分頁、篩選）"""
    stmt = select(MaintenanceRecord)
    if equipment_id:
        stmt = stmt.where(MaintenanceRecord.equipment_id == equipment_id)
    if maintenance_type:
        stmt = stmt.where(MaintenanceRecord.maintenance_type == maintenance_type)
    if start_date:
        stmt = stmt.where(MaintenanceRecord.start_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        stmt = stmt.where(MaintenanceRecord.start_time <= datetime.combine(end_date, datetime.max.time()))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    offset = (page - 1) * size
    paged = (
        stmt
        .options(
            selectinload(MaintenanceRecord.equipment),
            selectinload(MaintenanceRecord.engineer),
            selectinload(MaintenanceRecord.creator),
        )
        .order_by(MaintenanceRecord.start_time.desc())
        .offset(offset)
        .limit(size)
    )
    result = await db.execute(paged)
    records = result.scalars().all()

    return MaintenanceListResponse(
        items=[_maintenance_to_read(r) for r in records],
        total=total,
        page=page,
        size=size,
    )


@router.post("/maintenance", response_model=MaintenanceRead, status_code=status.HTTP_201_CREATED)
async def create_maintenance(
    payload: MaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增維修記錄（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    eq_res = await db.execute(select(Equipment).where(Equipment.id == payload.equipment_id))
    if not eq_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該設備")

    rec = MaintenanceRecord(
        equipment_id=payload.equipment_id,
        maintenance_type=payload.maintenance_type,
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        engineer_id=payload.engineer_id,
        parts_replaced=payload.parts_replaced,
        cost=payload.cost,
        result=payload.result,
        created_by=current_user.id,
    )
    db.add(rec)
    await db.commit()
    rec = await _load_maintenance(db, rec.id)
    return _maintenance_to_read(rec)


@router.get("/maintenance/{rec_id}", response_model=MaintenanceRead)
async def get_maintenance(
    rec_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得維修記錄詳情"""
    rec = await _load_maintenance(db, rec_id)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該維修記錄")
    return _maintenance_to_read(rec)


@router.put("/maintenance/{rec_id}", response_model=MaintenanceRead)
async def update_maintenance(
    rec_id: uuid.UUID,
    payload: MaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新維修記錄"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(MaintenanceRecord).where(MaintenanceRecord.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該維修記錄")

    if payload.maintenance_type is not None:
        rec.maintenance_type = payload.maintenance_type
    if payload.title is not None:
        rec.title = payload.title
    if payload.description is not None:
        rec.description = payload.description
    if payload.start_time is not None:
        rec.start_time = payload.start_time
    if payload.end_time is not None:
        rec.end_time = payload.end_time
    if payload.engineer_id is not None:
        rec.engineer_id = payload.engineer_id
    if payload.parts_replaced is not None:
        rec.parts_replaced = payload.parts_replaced
    if payload.cost is not None:
        rec.cost = payload.cost
    if payload.result is not None:
        rec.result = payload.result

    await db.commit()
    rec = await _load_maintenance(db, rec_id)
    return _maintenance_to_read(rec)


@router.delete("/maintenance/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_maintenance(
    rec_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """刪除維修記錄（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除記錄")

    result = await db.execute(select(MaintenanceRecord).where(MaintenanceRecord.id == rec_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該維修記錄")

    await db.delete(rec)
    await db.commit()


# ---------------------------------------------------------------------------
# PM Schedule endpoints
# ---------------------------------------------------------------------------

@router.get("/pm-schedules/list", response_model=list[PmScheduleRead])
async def list_pm_schedules(
    equipment_id: Optional[uuid.UUID] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    upcoming: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出 PM 排程"""
    stmt = select(PmSchedule).options(selectinload(PmSchedule.equipment)).where(PmSchedule.is_active == True)
    if equipment_id:
        stmt = stmt.where(PmSchedule.equipment_id == equipment_id)
    stmt = stmt.order_by(PmSchedule.next_pm_date.asc().nullsfirst())

    result = await db.execute(stmt)
    schedules = result.scalars().all()

    reads = [_pm_schedule_to_read(s) for s in schedules]

    # Filter after computing days_until_pm
    if is_overdue is not None:
        reads = [r for r in reads if r.is_overdue == is_overdue]
    if upcoming:
        reads = [r for r in reads if not r.is_overdue and r.days_until_pm <= 30]

    return reads


@router.post("/pm-schedules", response_model=PmScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_pm_schedule(
    payload: PmScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增 PM 排程（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    eq_res = await db.execute(select(Equipment).where(Equipment.id == payload.equipment_id))
    if not eq_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該設備")

    now = datetime.utcnow()
    base = payload.last_pm_date if payload.last_pm_date else now.date()
    next_pm = base + timedelta(days=payload.interval_days)

    sched = PmSchedule(
        equipment_id=payload.equipment_id,
        pm_name=payload.pm_name,
        interval_days=payload.interval_days,
        last_pm_date=payload.last_pm_date,
        next_pm_date=next_pm,
        estimated_duration_hours=payload.estimated_duration_hours,
        procedure_notes=payload.procedure_notes,
    )
    db.add(sched)
    await db.commit()
    sched = await _load_pm_schedule(db, sched.id)
    return _pm_schedule_to_read(sched)


@router.put("/pm-schedules/{sched_id}", response_model=PmScheduleRead)
async def update_pm_schedule(
    sched_id: uuid.UUID,
    payload: PmScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新 PM 排程"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(PmSchedule).where(PmSchedule.id == sched_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該 PM 排程")

    if payload.pm_name is not None:
        sched.pm_name = payload.pm_name
    if payload.interval_days is not None:
        sched.interval_days = payload.interval_days
    if payload.last_pm_date is not None:
        sched.last_pm_date = payload.last_pm_date
    if payload.estimated_duration_hours is not None:
        sched.estimated_duration_hours = payload.estimated_duration_hours
    if payload.procedure_notes is not None:
        sched.procedure_notes = payload.procedure_notes
    if payload.is_active is not None:
        sched.is_active = payload.is_active

    # Recompute next_pm_date
    sched.next_pm_date = _compute_next_pm(sched.last_pm_date, sched.created_at, sched.interval_days)
    sched.updated_at = datetime.utcnow()

    await db.commit()
    sched = await _load_pm_schedule(db, sched_id)
    return _pm_schedule_to_read(sched)


@router.delete("/pm-schedules/{sched_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pm_schedule(
    sched_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """刪除 PM 排程（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除記錄")

    result = await db.execute(select(PmSchedule).where(PmSchedule.id == sched_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該 PM 排程")

    await db.delete(sched)
    await db.commit()


@router.post("/pm-schedules/{sched_id}/complete", response_model=PmRecordRead, status_code=status.HTTP_201_CREATED)
async def complete_pm(
    sched_id: uuid.UUID,
    payload: PmCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """完成 PM（建立 PmRecord，更新 last_pm_date 和 next_pm_date）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(PmSchedule).where(PmSchedule.id == sched_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該 PM 排程")

    pm_record = PmRecord(
        schedule_id=sched_id,
        maintenance_record_id=payload.maintenance_record_id,
        completed_date=payload.completed_date,
        completed_by=current_user.id,
        notes=payload.notes,
    )
    db.add(pm_record)

    # Update schedule
    sched.last_pm_date = payload.completed_date
    sched.next_pm_date = payload.completed_date + timedelta(days=sched.interval_days)
    sched.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(pm_record)

    return PmRecordRead(
        id=pm_record.id,
        schedule_id=pm_record.schedule_id,
        maintenance_record_id=pm_record.maintenance_record_id,
        completed_date=pm_record.completed_date,
        completed_by=pm_record.completed_by,
        notes=pm_record.notes,
        created_at=pm_record.created_at,
    )
