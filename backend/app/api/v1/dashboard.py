"""
Dashboard API — Phase 6
Aggregates stats from all modules in a single call, plus focused sub-endpoints
for recent alarms, recent yield records, overdue PMs, and 7-day yield trend.
"""
from datetime import date, datetime, timedelta
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.sop import SopDocument
from app.models.process import ProcessRun, ProcessMeasurement
from app.models.yield_model import YieldRecord, YieldProduct, YieldStep
from app.models.equipment import (
    Equipment, AlarmRecord, PmSchedule,
    EquipmentStatus, AlarmSeverity,
)

router = APIRouter(prefix="/dashboard", tags=["儀表板"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_next_pm_date(last_date: Optional[date], created_at: datetime, interval_days: int) -> date:
    base = last_date if last_date is not None else created_at.date()
    return base + timedelta(days=interval_days)


# ---------------------------------------------------------------------------
# GET /dashboard/summary
# ---------------------------------------------------------------------------

@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate stats from all modules in one call.
    """
    now = datetime.utcnow()
    today = date.today()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    twenty_four_hours_ago = now - timedelta(hours=24)
    seven_days_from_now = today + timedelta(days=7)

    # ---- Yield stats -------------------------------------------------------
    avg_7d_res = await db.execute(
        select(func.avg(YieldRecord.yield_pct)).where(
            YieldRecord.measurement_date >= seven_days_ago.date()
        )
    )
    avg_7d = avg_7d_res.scalar_one() or 0.0

    avg_30d_res = await db.execute(
        select(func.avg(YieldRecord.yield_pct)).where(
            YieldRecord.measurement_date >= thirty_days_ago.date()
        )
    )
    avg_30d = avg_30d_res.scalar_one() or 0.0

    records_30d_res = await db.execute(
        select(func.count(YieldRecord.id)).where(
            YieldRecord.measurement_date >= thirty_days_ago.date()
        )
    )
    records_30d = records_30d_res.scalar_one() or 0

    below_90_res = await db.execute(
        select(func.count(YieldRecord.id)).where(
            YieldRecord.measurement_date >= thirty_days_ago.date(),
            YieldRecord.yield_pct < 90,
        )
    )
    below_90_count = below_90_res.scalar_one() or 0

    # ---- Equipment stats ---------------------------------------------------
    total_eq_res = await db.execute(
        select(func.count(Equipment.id)).where(Equipment.is_active == True)
    )
    total_equipment = total_eq_res.scalar_one() or 0

    normal_res = await db.execute(
        select(func.count(Equipment.id)).where(
            Equipment.is_active == True,
            Equipment.status == EquipmentStatus.normal,
        )
    )
    normal_count = normal_res.scalar_one() or 0

    alarm_or_down_res = await db.execute(
        select(func.count(Equipment.id)).where(
            Equipment.is_active == True,
            Equipment.status.in_([EquipmentStatus.alarm, EquipmentStatus.down]),
        )
    )
    alarm_or_down = alarm_or_down_res.scalar_one() or 0

    alarms_24h_res = await db.execute(
        select(func.count(AlarmRecord.id)).where(
            AlarmRecord.occurred_at >= twenty_four_hours_ago
        )
    )
    alarms_24h = alarms_24h_res.scalar_one() or 0

    critical_7d_res = await db.execute(
        select(func.count(AlarmRecord.id)).where(
            AlarmRecord.occurred_at >= seven_days_ago,
            AlarmRecord.severity == AlarmSeverity.critical,
        )
    )
    critical_alarms_7d = critical_7d_res.scalar_one() or 0

    downtime_7d_res = await db.execute(
        select(func.sum(AlarmRecord.downtime_minutes)).where(
            AlarmRecord.occurred_at >= seven_days_ago,
            AlarmRecord.downtime_minutes.isnot(None),
        )
    )
    downtime_minutes_7d = downtime_7d_res.scalar_one() or 0
    downtime_hours_7d = round((downtime_minutes_7d or 0) / 60, 2)

    # PM overdue / upcoming
    pm_res = await db.execute(
        select(PmSchedule)
        .options(selectinload(PmSchedule.equipment))
        .where(PmSchedule.is_active == True)
    )
    all_pms = pm_res.scalars().all()
    overdue_pms = 0
    upcoming_pms_7d = 0
    for sched in all_pms:
        next_pm = sched.next_pm_date or _compute_next_pm_date(
            sched.last_pm_date, sched.created_at, sched.interval_days
        )
        days_until = (next_pm - today).days
        if days_until < 0:
            overdue_pms += 1
        elif days_until <= 7:
            upcoming_pms_7d += 1

    # ---- Process stats -----------------------------------------------------
    runs_7d_res = await db.execute(
        select(func.count(ProcessRun.id)).where(
            ProcessRun.run_date >= seven_days_ago.date()
        )
    )
    runs_7d = runs_7d_res.scalar_one() or 0

    # Runs with at least one out-of-spec measurement in last 7 days
    oos_subq = (
        select(ProcessMeasurement.run_id)
        .where(ProcessMeasurement.is_out_of_spec == True)
        .distinct()
        .scalar_subquery()
    )
    oos_runs_res = await db.execute(
        select(func.count(ProcessRun.id)).where(
            ProcessRun.run_date >= seven_days_ago.date(),
            ProcessRun.id.in_(oos_subq),
        )
    )
    out_of_spec_runs_7d = oos_runs_res.scalar_one() or 0

    # ---- SOP stats ---------------------------------------------------------
    total_docs_res = await db.execute(
        select(func.count(SopDocument.id)).where(SopDocument.is_active == True)
    )
    total_docs = total_docs_res.scalar_one() or 0

    updated_7d_res = await db.execute(
        select(func.count(SopDocument.id)).where(
            SopDocument.is_active == True,
            SopDocument.updated_at >= seven_days_ago,
        )
    )
    updated_7d = updated_7d_res.scalar_one() or 0

    return {
        "yield": {
            "avg_7d": round(float(avg_7d), 2),
            "avg_30d": round(float(avg_30d), 2),
            "records_30d": records_30d,
            "below_90_count": below_90_count,
        },
        "equipment": {
            "total": total_equipment,
            "normal": normal_count,
            "alarm_or_down": alarm_or_down,
            "alarms_24h": alarms_24h,
            "critical_alarms_7d": critical_alarms_7d,
            "downtime_hours_7d": downtime_hours_7d,
            "overdue_pms": overdue_pms,
            "upcoming_pms_7d": upcoming_pms_7d,
        },
        "process": {
            "runs_7d": runs_7d,
            "out_of_spec_runs_7d": out_of_spec_runs_7d,
        },
        "sop": {
            "total_docs": total_docs,
            "updated_7d": updated_7d,
        },
    }


# ---------------------------------------------------------------------------
# GET /dashboard/recent-alarms
# ---------------------------------------------------------------------------

@router.get("/recent-alarms")
async def get_recent_alarms(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Most recent unresolved alarms."""
    result = await db.execute(
        select(AlarmRecord)
        .options(selectinload(AlarmRecord.equipment))
        .where(AlarmRecord.resolved_at.is_(None))
        .order_by(AlarmRecord.occurred_at.desc())
        .limit(limit)
    )
    alarms = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "equipment_name": a.equipment.name if a.equipment else "未知",
            "severity": a.severity,
            "title": a.title,
            "occurred_at": a.occurred_at.isoformat(),
        }
        for a in alarms
    ]


# ---------------------------------------------------------------------------
# GET /dashboard/recent-yield
# ---------------------------------------------------------------------------

@router.get("/recent-yield")
async def get_recent_yield(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Most recent yield records."""
    result = await db.execute(
        select(YieldRecord)
        .options(
            selectinload(YieldRecord.product),
            selectinload(YieldRecord.step),
        )
        .order_by(YieldRecord.measurement_date.desc(), YieldRecord.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "lot_id": r.lot_id,
            "product_name": r.product.name if r.product else "未知",
            "step_name": r.step.name if r.step else "未知",
            "yield_pct": r.yield_pct,
            "measurement_date": r.measurement_date.isoformat(),
        }
        for r in records
    ]


# ---------------------------------------------------------------------------
# GET /dashboard/overdue-pms
# ---------------------------------------------------------------------------

@router.get("/overdue-pms")
async def get_overdue_pms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All overdue PM schedules."""
    today = date.today()

    result = await db.execute(
        select(PmSchedule)
        .options(selectinload(PmSchedule.equipment))
        .where(PmSchedule.is_active == True)
    )
    schedules = result.scalars().all()

    overdue = []
    for sched in schedules:
        next_pm = sched.next_pm_date or _compute_next_pm_date(
            sched.last_pm_date, sched.created_at, sched.interval_days
        )
        days_until = (next_pm - today).days
        if days_until < 0:
            overdue.append(
                {
                    "id": str(sched.id),
                    "equipment_name": sched.equipment.name if sched.equipment else "未知",
                    "pm_name": sched.pm_name,
                    "next_pm_date": next_pm.isoformat(),
                    "days_overdue": abs(days_until),
                }
            )

    # Sort most overdue first
    overdue.sort(key=lambda x: x["days_overdue"], reverse=True)
    return overdue


# ---------------------------------------------------------------------------
# GET /dashboard/yield-trend-7d
# ---------------------------------------------------------------------------

@router.get("/yield-trend-7d")
async def get_yield_trend_7d(
    product_id: Optional[str] = Query(None),
    step_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Average yield per day for the last 7 days."""
    today = date.today()
    seven_days_ago = today - timedelta(days=6)  # inclusive: 7 days total

    stmt = select(
        YieldRecord.measurement_date,
        func.avg(YieldRecord.yield_pct).label("avg_yield"),
    ).where(YieldRecord.measurement_date >= seven_days_ago)

    if product_id:
        try:
            pid = uuid.UUID(product_id)
            stmt = stmt.where(YieldRecord.product_id == pid)
        except ValueError:
            pass

    if step_id:
        try:
            sid = uuid.UUID(step_id)
            stmt = stmt.where(YieldRecord.step_id == sid)
        except ValueError:
            pass

    stmt = stmt.group_by(YieldRecord.measurement_date).order_by(YieldRecord.measurement_date)

    result = await db.execute(stmt)
    rows = result.all()

    # Build a complete 7-day series (fill missing days with None)
    data_map: dict[date, Optional[float]] = {}
    for row in rows:
        data_map[row.measurement_date] = round(float(row.avg_yield), 2) if row.avg_yield is not None else None

    trend = []
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        trend.append(
            {
                "date": d.isoformat(),
                "avg_yield": data_map.get(d),
            }
        )

    return trend
