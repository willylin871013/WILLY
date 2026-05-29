import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Category schemas
# ---------------------------------------------------------------------------

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    doc_count: Optional[int] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Tag schemas
# ---------------------------------------------------------------------------

class TagCreate(BaseModel):
    name: str


class TagRead(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Version schemas
# ---------------------------------------------------------------------------

class VersionCreate(BaseModel):
    change_notes: Optional[str] = None
    # version string is auto-incremented unless manually provided
    version: Optional[str] = None


class VersionRead(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version: str
    file_name: Optional[str] = None
    change_notes: Optional[str] = None
    created_at: datetime
    creator_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Document schemas
# ---------------------------------------------------------------------------

class DocumentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    tags: list[str] = []


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    tags: Optional[list[str]] = None


class DocumentRead(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    category: Optional[CategoryRead] = None
    tags: list[TagRead] = []
    version: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    creator_name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    versions: Optional[list[VersionRead]] = None

    model_config = {"from_attributes": True}


class DocumentListItem(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    category: Optional[CategoryRead] = None
    tags: list[TagRead] = []
    version: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    creator_name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class SopListResponse(BaseModel):
    items: list[DocumentListItem]
    total: int
    page: int
    size: int
