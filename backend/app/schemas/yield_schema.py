import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Product schemas
# ---------------------------------------------------------------------------

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    product_code: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class ProductRead(BaseModel):
    id: uuid.UUID
    name: str
    product_code: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    product_code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Step schemas
# ---------------------------------------------------------------------------

class StepCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sequence_order: int = Field(0, ge=0)
    description: Optional[str] = None


class StepRead(BaseModel):
    id: uuid.UUID
    name: str
    sequence_order: int
    description: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Loss Category schemas
# ---------------------------------------------------------------------------

class LossCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    color: str = Field("#ff4d4f", max_length=20)


class LossCategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    color: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Loss Record schemas
# ---------------------------------------------------------------------------

class LossRecordInput(BaseModel):
    category_id: uuid.UUID
    loss_pct: float = Field(..., ge=0, le=100)
    notes: Optional[str] = None


class LossRecordRead(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    color: str
    loss_pct: float
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Yield Record schemas
# ---------------------------------------------------------------------------

class RecordCreate(BaseModel):
    lot_id: str = Field(..., min_length=1, max_length=100)
    product_id: uuid.UUID
    step_id: uuid.UUID
    measurement_date: date
    yield_pct: float = Field(..., ge=0, le=100)
    wafer_in: Optional[int] = Field(None, ge=0)
    wafer_out: Optional[int] = Field(None, ge=0)
    die_per_wafer: Optional[int] = Field(None, ge=0)
    good_die: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None
    loss_records: list[LossRecordInput] = Field(default_factory=list)


class RecordRead(BaseModel):
    id: uuid.UUID
    lot_id: str
    product_id: uuid.UUID
    product_name: str
    product_code: str
    step_id: uuid.UUID
    step_name: str
    measurement_date: date
    yield_pct: float
    wafer_in: Optional[int] = None
    wafer_out: Optional[int] = None
    die_per_wafer: Optional[int] = None
    good_die: Optional[int] = None
    notes: Optional[str] = None
    loss_records: list[LossRecordRead] = Field(default_factory=list)
    creator_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RecordUpdate(BaseModel):
    lot_id: Optional[str] = None
    measurement_date: Optional[date] = None
    yield_pct: Optional[float] = Field(None, ge=0, le=100)
    wafer_in: Optional[int] = Field(None, ge=0)
    wafer_out: Optional[int] = Field(None, ge=0)
    die_per_wafer: Optional[int] = Field(None, ge=0)
    good_die: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None


class RecordListResponse(BaseModel):
    items: list[RecordRead]
    total: int
    page: int
    size: int


# ---------------------------------------------------------------------------
# Analytics schemas
# ---------------------------------------------------------------------------

class TrendRecord(BaseModel):
    record_id: uuid.UUID
    lot_id: str
    date: date
    yield_pct: float


class SpcPoint(BaseModel):
    lot_id: str
    date: date
    value: float
    mr: Optional[float] = None
    out_of_control: bool


class SpcData(BaseModel):
    points: list[SpcPoint]
    mean: float
    std: float
    ucl: float
    lcl: float
    mr_ucl: float
    cp: Optional[float] = None
    cpk: Optional[float] = None


class SummaryStats(BaseModel):
    count: int
    mean: float
    std: float
    min: float
    max: float
    p25: float
    p50: float
    p75: float
    cp: Optional[float] = None
    cpk: Optional[float] = None
    yield_target: Optional[float] = None


class ParetoItem(BaseModel):
    category_name: str
    color: str
    total_loss_pct: float
    record_count: int


class BulkImportResult(BaseModel):
    success_count: int
    error_count: int
    errors: list[str]
