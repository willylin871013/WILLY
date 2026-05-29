import uuid
from datetime import datetime, date
from sqlalchemy import String, Text, Boolean, DateTime, Date, Integer, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ProcessRecipe(Base):
    __tablename__ = "process_recipes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    process_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    creator: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[created_by], lazy="select"
    )
    parameters: Mapped[list["ProcessParameter"]] = relationship(
        "ProcessParameter",
        back_populates="recipe",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="ProcessParameter.display_order",
    )
    runs: Mapped[list["ProcessRun"]] = relationship(
        "ProcessRun", back_populates="recipe", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<ProcessRecipe id={self.id} name={self.name}>"


class ProcessParameter(Base):
    __tablename__ = "process_parameters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("process_recipes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    spec_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    spec_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    target: Mapped[float | None] = mapped_column(Float, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    recipe: Mapped["ProcessRecipe"] = relationship(
        "ProcessRecipe", back_populates="parameters", lazy="select"
    )
    measurements: Mapped[list["ProcessMeasurement"]] = relationship(
        "ProcessMeasurement", back_populates="parameter", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<ProcessParameter id={self.id} name={self.name}>"


class ProcessRun(Base):
    __tablename__ = "process_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("process_recipes.id", ondelete="RESTRICT"), nullable=False
    )
    lot_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    operator_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    recipe: Mapped["ProcessRecipe"] = relationship(
        "ProcessRecipe", back_populates="runs", lazy="select"
    )
    operator: Mapped["User | None"] = relationship(  # noqa: F821
        "User", foreign_keys=[operator_id], lazy="select"
    )
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[created_by], lazy="select"
    )
    measurements: Mapped[list["ProcessMeasurement"]] = relationship(
        "ProcessMeasurement",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<ProcessRun id={self.id} lot_id={self.lot_id}>"


class ProcessMeasurement(Base):
    __tablename__ = "process_measurements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("process_runs.id", ondelete="CASCADE"), nullable=False
    )
    parameter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("process_parameters.id", ondelete="RESTRICT"),
        nullable=False,
    )
    value: Mapped[float] = mapped_column(Float, nullable=False)
    is_out_of_spec: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    run: Mapped["ProcessRun"] = relationship(
        "ProcessRun", back_populates="measurements", lazy="select"
    )
    parameter: Mapped["ProcessParameter"] = relationship(
        "ProcessParameter", back_populates="measurements", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<ProcessMeasurement id={self.id} value={self.value}>"


# Import User to allow relationships to resolve
from app.models.user import User  # noqa: E402, F401
