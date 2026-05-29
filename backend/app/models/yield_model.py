import uuid
from datetime import datetime, date
from sqlalchemy import String, Text, Boolean, DateTime, Date, Integer, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class YieldProduct(Base):
    __tablename__ = "yield_products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    product_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    records: Mapped[list["YieldRecord"]] = relationship(
        "YieldRecord", back_populates="product", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<YieldProduct id={self.id} code={self.product_code}>"


class YieldStep(Base):
    __tablename__ = "yield_steps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    sequence_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    records: Mapped[list["YieldRecord"]] = relationship(
        "YieldRecord", back_populates="step", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<YieldStep id={self.id} name={self.name}>"


class YieldRecord(Base):
    __tablename__ = "yield_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lot_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("yield_products.id", ondelete="RESTRICT"), nullable=False
    )
    step_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("yield_steps.id", ondelete="RESTRICT"), nullable=False
    )
    measurement_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    yield_pct: Mapped[float] = mapped_column(Float, nullable=False)
    wafer_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wafer_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    die_per_wafer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    good_die: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    product: Mapped["YieldProduct"] = relationship(
        "YieldProduct", back_populates="records", lazy="select"
    )
    step: Mapped["YieldStep"] = relationship(
        "YieldStep", back_populates="records", lazy="select"
    )
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[created_by], lazy="select"
    )
    loss_records: Mapped[list["YieldLossRecord"]] = relationship(
        "YieldLossRecord",
        back_populates="yield_record",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<YieldRecord id={self.id} lot_id={self.lot_id} yield={self.yield_pct}>"


class YieldLossCategory(Base):
    __tablename__ = "yield_loss_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#ff4d4f", nullable=False)

    loss_records: Mapped[list["YieldLossRecord"]] = relationship(
        "YieldLossRecord", back_populates="category", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<YieldLossCategory id={self.id} name={self.name}>"


class YieldLossRecord(Base):
    __tablename__ = "yield_loss_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    yield_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("yield_records.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("yield_loss_categories.id", ondelete="RESTRICT"), nullable=False
    )
    loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    yield_record: Mapped["YieldRecord"] = relationship(
        "YieldRecord", back_populates="loss_records", lazy="select"
    )
    category: Mapped["YieldLossCategory"] = relationship(
        "YieldLossCategory", back_populates="loss_records", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<YieldLossRecord id={self.id} loss_pct={self.loss_pct}>"


# Import User to allow relationships to resolve
from app.models.user import User  # noqa: E402, F401
