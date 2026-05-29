import enum
import uuid
from datetime import datetime, date
from sqlalchemy import (
    String, Boolean, DateTime, Date, Integer, Float, Text,
    Enum as SAEnum, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class EquipmentStatus(str, enum.Enum):
    normal = "normal"
    alarm = "alarm"
    down = "down"
    maintenance = "maintenance"
    pm = "pm"


class AlarmSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MaintenanceType(str, enum.Enum):
    repair = "repair"
    pm = "pm"
    calibration = "calibration"
    inspection = "inspection"


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    equipment_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    equipment_type: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[EquipmentStatus] = mapped_column(
        SAEnum(EquipmentStatus, name="equipmentstatus"),
        default=EquipmentStatus.normal,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    alarm_records: Mapped[list["AlarmRecord"]] = relationship(
        "AlarmRecord", back_populates="equipment", foreign_keys="AlarmRecord.equipment_id",
        lazy="select",
    )
    maintenance_records: Mapped[list["MaintenanceRecord"]] = relationship(
        "MaintenanceRecord", back_populates="equipment", lazy="select",
    )
    pm_schedules: Mapped[list["PmSchedule"]] = relationship(
        "PmSchedule", back_populates="equipment", lazy="select",
    )


class AlarmRecord(Base):
    __tablename__ = "alarm_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    alarm_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    alarm_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[AlarmSeverity] = mapped_column(
        SAEnum(AlarmSeverity, name="alarmseverity"),
        default=AlarmSeverity.medium,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    downtime_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrective_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    reported_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    resolved_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    equipment: Mapped["Equipment"] = relationship(
        "Equipment", back_populates="alarm_records", foreign_keys=[equipment_id]
    )
    reporter: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[reported_by], lazy="select"
    )
    resolver: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[resolved_by], lazy="select"
    )


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    maintenance_type: Mapped[MaintenanceType] = mapped_column(
        SAEnum(MaintenanceType, name="maintenancetype"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    engineer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    parts_replaced: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    equipment: Mapped["Equipment"] = relationship(
        "Equipment", back_populates="maintenance_records"
    )
    engineer: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[engineer_id], lazy="select"
    )
    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by], lazy="select"
    )


class PmSchedule(Base):
    __tablename__ = "pm_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    pm_name: Mapped[str] = mapped_column(String(200), nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    last_pm_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_pm_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    estimated_duration_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    procedure_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    equipment: Mapped["Equipment"] = relationship(
        "Equipment", back_populates="pm_schedules"
    )
    pm_records: Mapped[list["PmRecord"]] = relationship(
        "PmRecord", back_populates="schedule", lazy="select"
    )


class PmRecord(Base):
    __tablename__ = "pm_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pm_schedules.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    maintenance_record_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("maintenance_records.id", ondelete="SET NULL"), nullable=True
    )
    completed_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    schedule: Mapped["PmSchedule"] = relationship(
        "PmSchedule", back_populates="pm_records"
    )
    completer: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[completed_by], lazy="select"
    )


# Avoid circular import – import User here only for type checking
from app.models.user import User  # noqa: E402, F401
