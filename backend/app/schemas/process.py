import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Parameter schemas
# ---------------------------------------------------------------------------

class ParameterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    unit: Optional[str] = Field(None, max_length=50)
    spec_min: Optional[float] = None
    spec_max: Optional[float] = None
    target: Optional[float] = None
    display_order: int = Field(0, ge=0)


class ParameterRead(BaseModel):
    id: uuid.UUID
    recipe_id: uuid.UUID
    name: str
    unit: Optional[str] = None
    spec_min: Optional[float] = None
    spec_max: Optional[float] = None
    target: Optional[float] = None
    display_order: int

    model_config = {"from_attributes": True}


class ParameterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    unit: Optional[str] = Field(None, max_length=50)
    spec_min: Optional[float] = None
    spec_max: Optional[float] = None
    target: Optional[float] = None
    display_order: Optional[int] = Field(None, ge=0)


# ---------------------------------------------------------------------------
# Recipe schemas
# ---------------------------------------------------------------------------

class RecipeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    process_type: str = Field(..., min_length=1, max_length=50)
    parameters: list[ParameterCreate] = Field(default_factory=list)


class RecipeRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    process_type: str
    parameters: list[ParameterRead] = Field(default_factory=list)
    creator_name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class RecipeListItem(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    process_type: str
    parameter_count: int
    creator_name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class RecipeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    process_type: Optional[str] = Field(None, min_length=1, max_length=50)
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Measurement schemas
# ---------------------------------------------------------------------------

class MeasurementInput(BaseModel):
    parameter_id: uuid.UUID
    value: float


class MeasurementRead(BaseModel):
    id: uuid.UUID
    parameter_id: uuid.UUID
    parameter_name: str
    unit: Optional[str] = None
    spec_min: Optional[float] = None
    spec_max: Optional[float] = None
    target: Optional[float] = None
    value: float
    is_out_of_spec: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Run schemas
# ---------------------------------------------------------------------------

class RunCreate(BaseModel):
    recipe_id: uuid.UUID
    lot_id: str = Field(..., min_length=1, max_length=100)
    run_date: date
    operator_id: Optional[int] = None
    notes: Optional[str] = None
    measurements: list[MeasurementInput] = Field(default_factory=list)


class RunRead(BaseModel):
    id: uuid.UUID
    recipe_id: uuid.UUID
    recipe_name: str
    lot_id: str
    run_date: date
    operator_name: Optional[str] = None
    notes: Optional[str] = None
    measurements: list[MeasurementRead] = Field(default_factory=list)
    out_of_spec_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class RunListItem(BaseModel):
    id: uuid.UUID
    recipe_id: uuid.UUID
    recipe_name: str
    lot_id: str
    run_date: date
    operator_name: Optional[str] = None
    notes: Optional[str] = None
    out_of_spec_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class RunUpdate(BaseModel):
    notes: Optional[str] = None
    operator_id: Optional[int] = None


class RunListResponse(BaseModel):
    items: list[RunListItem]
    total: int
    page: int
    size: int


# ---------------------------------------------------------------------------
# CSV import
# ---------------------------------------------------------------------------

class BulkImportResult(BaseModel):
    success_count: int
    error_count: int
    errors: list[str]


# ---------------------------------------------------------------------------
# Trend data
# ---------------------------------------------------------------------------

class TrendPoint(BaseModel):
    run_id: uuid.UUID
    lot_id: str
    run_date: date
    value: float
    is_out_of_spec: bool

    model_config = {"from_attributes": True}
