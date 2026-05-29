import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.deps import get_current_user
from app.models.sop import SopCategory, SopTag, SopDocument, SopDocumentTag, SopVersion
from app.models.user import User, UserRole
from app.schemas.sop import (
    CategoryCreate, CategoryRead,
    TagCreate, TagRead,
    DocumentUpdate, DocumentRead, DocumentListItem, SopListResponse,
    VersionRead,
)

router = APIRouter(prefix="/sop", tags=["SOP知識庫"])

UPLOAD_DIR = "/app/uploads/sop"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _increment_version(version: str) -> str:
    """Auto-increment minor version: 1.0 -> 1.1 -> 1.2"""
    try:
        parts = version.split(".")
        if len(parts) >= 2:
            major = int(parts[0])
            minor = int(parts[1])
            return f"{major}.{minor + 1}"
    except (ValueError, IndexError):
        pass
    return version


async def _save_upload_file(file: UploadFile, document_id: uuid.UUID) -> tuple[str, str, int]:
    """Save uploaded file, return (file_path, file_name, file_size)."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = file.filename or "unnamed"
    dest_filename = f"{document_id}_{safe_name}"
    dest_path = os.path.join(UPLOAD_DIR, dest_filename)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="檔案大小不得超過 50MB",
        )

    with open(dest_path, "wb") as f:
        f.write(content)

    return dest_path, safe_name, len(content)


async def _load_document_with_relations(
    db: AsyncSession, document_id: uuid.UUID, active_only: bool = True
) -> SopDocument:
    """Load a SopDocument with all relationships eagerly loaded."""
    conditions = [SopDocument.id == document_id]
    if active_only:
        conditions.append(SopDocument.is_active == True)

    result = await db.execute(
        select(SopDocument)
        .options(
            selectinload(SopDocument.category),
            selectinload(SopDocument.creator),
            selectinload(SopDocument.document_tags).selectinload(SopDocumentTag.tag),
            selectinload(SopDocument.versions).selectinload(SopVersion.creator),
        )
        .where(*conditions)
    )
    return result.scalar_one_or_none()


def _doc_to_read(doc: SopDocument, include_versions: bool = False) -> DocumentRead:
    """Convert a loaded SopDocument ORM object into a DocumentRead schema."""
    category_data = None
    if doc.category:
        category_data = CategoryRead(
            id=doc.category.id,
            name=doc.category.name,
            description=doc.category.description,
            created_at=doc.category.created_at,
        )

    tags_data = [
        TagRead(id=dt.tag.id, name=dt.tag.name)
        for dt in doc.document_tags
        if dt.tag is not None
    ]

    creator_name = doc.creator.full_name if doc.creator else "未知"

    versions_data = None
    if include_versions:
        versions_data = [
            VersionRead(
                id=v.id,
                document_id=v.document_id,
                version=v.version,
                file_name=v.file_name,
                change_notes=v.change_notes,
                created_at=v.created_at,
                creator_name=v.creator.full_name if v.creator else "未知",
            )
            for v in doc.versions
        ]

    return DocumentRead(
        id=doc.id,
        title=doc.title,
        description=doc.description,
        content=doc.content,
        category=category_data,
        tags=tags_data,
        version=doc.version,
        file_name=doc.file_name,
        file_size=doc.file_size,
        creator_name=creator_name,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        is_active=doc.is_active,
        versions=versions_data,
    )


async def _get_or_create_tag(db: AsyncSession, tag_name: str) -> SopTag:
    """Return existing tag or create a new one."""
    tag_result = await db.execute(select(SopTag).where(SopTag.name == tag_name))
    tag_obj = tag_result.scalar_one_or_none()
    if not tag_obj:
        tag_obj = SopTag(name=tag_name)
        db.add(tag_obj)
        await db.flush()
    return tag_obj


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有分類（含文件數量）"""
    result = await db.execute(
        select(SopCategory).order_by(SopCategory.name)
    )
    categories = result.scalars().all()

    # Count active documents per category
    count_result = await db.execute(
        select(SopDocument.category_id, func.count(SopDocument.id).label("cnt"))
        .where(SopDocument.is_active == True)
        .group_by(SopDocument.category_id)
    )
    counts = {row.category_id: row.cnt for row in count_result}

    return [
        CategoryRead(
            id=c.id,
            name=c.name,
            description=c.description,
            created_at=c.created_at,
            doc_count=counts.get(c.id, 0),
        )
        for c in categories
    ]


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立分類（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    existing = await db.execute(select(SopCategory).where(SopCategory.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="分類名稱已存在")

    category = SopCategory(name=payload.name, description=payload.description)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryRead(
        id=category.id,
        name=category.name,
        description=category.description,
        created_at=category.created_at,
        doc_count=0,
    )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """刪除分類（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除分類")

    result = await db.execute(select(SopCategory).where(SopCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該分類")

    await db.delete(category)
    await db.commit()


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

@router.get("/tags", response_model=list[TagRead])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有標籤"""
    result = await db.execute(select(SopTag).order_by(SopTag.name))
    return result.scalars().all()


@router.post("/tags", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立標籤（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    existing = await db.execute(select(SopTag).where(SopTag.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="標籤名稱已存在")

    tag = SopTag(name=payload.name)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

@router.get("/documents", response_model=SopListResponse)
async def list_documents(
    page: int = Query(1, ge=1, description="頁碼"),
    size: int = Query(20, ge=1, le=100, description="每頁筆數"),
    category_id: Optional[uuid.UUID] = Query(None, description="依分類篩選"),
    tag: Optional[str] = Query(None, description="依標籤名稱篩選"),
    search: Optional[str] = Query(None, description="搜尋標題/說明/內容"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出文件（含分頁、篩選、搜尋）"""
    base_stmt = (
        select(SopDocument)
        .where(SopDocument.is_active == True)
    )

    if category_id:
        base_stmt = base_stmt.where(SopDocument.category_id == category_id)

    if tag:
        tag_subq = (
            select(SopDocumentTag.document_id)
            .join(SopTag, SopDocumentTag.tag_id == SopTag.id)
            .where(SopTag.name == tag)
            .scalar_subquery()
        )
        base_stmt = base_stmt.where(SopDocument.id.in_(tag_subq))

    if search:
        pattern = f"%{search}%"
        base_stmt = base_stmt.where(
            or_(
                SopDocument.title.ilike(pattern),
                SopDocument.description.ilike(pattern),
                SopDocument.content.ilike(pattern),
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Fetch page with relationships
    offset = (page - 1) * size
    paged_stmt = (
        base_stmt
        .options(
            selectinload(SopDocument.category),
            selectinload(SopDocument.creator),
            selectinload(SopDocument.document_tags).selectinload(SopDocumentTag.tag),
        )
        .order_by(SopDocument.updated_at.desc())
        .offset(offset)
        .limit(size)
    )
    result = await db.execute(paged_stmt)
    docs = result.scalars().all()

    items = []
    for doc in docs:
        category_data = None
        if doc.category:
            category_data = CategoryRead(
                id=doc.category.id,
                name=doc.category.name,
                description=doc.category.description,
                created_at=doc.category.created_at,
            )
        tags_data = [
            TagRead(id=dt.tag.id, name=dt.tag.name)
            for dt in doc.document_tags
            if dt.tag is not None
        ]
        items.append(
            DocumentListItem(
                id=doc.id,
                title=doc.title,
                description=doc.description,
                category=category_data,
                tags=tags_data,
                version=doc.version,
                file_name=doc.file_name,
                file_size=doc.file_size,
                creator_name=doc.creator.full_name if doc.creator else "未知",
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                is_active=doc.is_active,
            )
        )

    return SopListResponse(items=items, total=total, page=page, size=size)


@router.post("/documents", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    title: str = Form(..., description="文件標題"),
    description: Optional[str] = Form(None, description="簡短說明"),
    content: Optional[str] = Form(None, description="文件內容/排除步驟"),
    category_id: Optional[str] = Form(None, description="分類 UUID"),
    tags: Optional[str] = Form(None, description="逗號分隔的標籤名稱"),
    file: Optional[UploadFile] = File(None, description="附件（可選）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立新文件（工程師以上，支援可選檔案上傳）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    cat_uuid: Optional[uuid.UUID] = None
    if category_id:
        try:
            cat_uuid = uuid.UUID(category_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="無效的分類 ID 格式")
        cat_check = await db.execute(select(SopCategory).where(SopCategory.id == cat_uuid))
        if not cat_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="找不到指定分類")

    doc = SopDocument(
        title=title,
        description=description,
        content=content,
        category_id=cat_uuid,
        version="1.0",
        created_by=current_user.id,
    )
    db.add(doc)
    await db.flush()  # get doc.id

    # Handle file upload
    if file and file.filename:
        file_path, file_name, file_size = await _save_upload_file(file, doc.id)
        doc.file_path = file_path
        doc.file_name = file_name
        doc.file_size = file_size

    # Handle tags
    if tags:
        tag_names = [t.strip() for t in tags.split(",") if t.strip()]
        for tag_name in tag_names:
            tag_obj = await _get_or_create_tag(db, tag_name)
            db.add(SopDocumentTag(document_id=doc.id, tag_id=tag_obj.id))

    await db.commit()

    doc = await _load_document_with_relations(db, doc.id)
    return _doc_to_read(doc, include_versions=True)


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得文件詳情（含版本歷史）"""
    doc = await _load_document_with_relations(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該文件")
    return _doc_to_read(doc, include_versions=True)


@router.put("/documents/{document_id}", response_model=DocumentRead)
async def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新文件資訊（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(
        select(SopDocument).where(SopDocument.id == document_id, SopDocument.is_active == True)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該文件")

    if payload.title is not None:
        doc.title = payload.title
    if payload.description is not None:
        doc.description = payload.description
    if payload.content is not None:
        doc.content = payload.content
    if payload.category_id is not None:
        cat_check = await db.execute(
            select(SopCategory).where(SopCategory.id == payload.category_id)
        )
        if not cat_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="找不到指定分類")
        doc.category_id = payload.category_id

    if payload.tags is not None:
        # Remove existing tags
        existing_result = await db.execute(
            select(SopDocumentTag).where(SopDocumentTag.document_id == doc.id)
        )
        for dt in existing_result.scalars().all():
            await db.delete(dt)
        await db.flush()

        # Add new tags
        for tag_name in payload.tags:
            tag_obj = await _get_or_create_tag(db, tag_name)
            db.add(SopDocumentTag(document_id=doc.id, tag_id=tag_obj.id))

    doc.updated_at = datetime.utcnow()
    await db.commit()

    doc = await _load_document_with_relations(db, document_id)
    return _doc_to_read(doc, include_versions=True)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """軟刪除文件（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除文件")

    result = await db.execute(
        select(SopDocument).where(SopDocument.id == document_id, SopDocument.is_active == True)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該文件")

    doc.is_active = False
    doc.updated_at = datetime.utcnow()
    await db.commit()


@router.post("/documents/{document_id}/upload", response_model=DocumentRead)
async def upload_file_for_document(
    document_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """為現有文件上傳/替換檔案（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(
        select(SopDocument).where(SopDocument.id == document_id, SopDocument.is_active == True)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該文件")

    file_path, file_name, file_size = await _save_upload_file(file, doc.id)
    doc.file_path = file_path
    doc.file_name = file_name
    doc.file_size = file_size
    doc.updated_at = datetime.utcnow()
    await db.commit()

    doc = await _load_document_with_relations(db, document_id)
    return _doc_to_read(doc, include_versions=True)


# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------

@router.get("/documents/{document_id}/versions", response_model=list[VersionRead])
async def list_versions(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出文件版本歷史"""
    doc_check = await db.execute(
        select(SopDocument.id).where(SopDocument.id == document_id, SopDocument.is_active == True)
    )
    if not doc_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="找不到該文件")

    result = await db.execute(
        select(SopVersion)
        .options(selectinload(SopVersion.creator))
        .where(SopVersion.document_id == document_id)
        .order_by(SopVersion.created_at.desc())
    )
    versions = result.scalars().all()
    return [
        VersionRead(
            id=v.id,
            document_id=v.document_id,
            version=v.version,
            file_name=v.file_name,
            change_notes=v.change_notes,
            created_at=v.created_at,
            creator_name=v.creator.full_name if v.creator else "未知",
        )
        for v in versions
    ]


@router.post(
    "/documents/{document_id}/versions",
    response_model=VersionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_version(
    document_id: uuid.UUID,
    change_notes: Optional[str] = Form(None, description="變更說明"),
    version: Optional[str] = Form(None, description="版本號（留空自動遞增）"),
    file: Optional[UploadFile] = File(None, description="新版本檔案（可選）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立新版本（工程師以上）：快照當前版本，遞增版本號"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(
        select(SopDocument).where(SopDocument.id == document_id, SopDocument.is_active == True)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="找不到該文件")

    # Snapshot current version record
    snap = SopVersion(
        document_id=doc.id,
        version=doc.version,
        file_path=doc.file_path,
        file_name=doc.file_name,
        change_notes=change_notes,
        created_by=current_user.id,
    )
    db.add(snap)

    # Bump document version
    new_version = version.strip() if version and version.strip() else _increment_version(doc.version)
    doc.version = new_version

    # Replace file if provided
    if file and file.filename:
        file_path, file_name, file_size = await _save_upload_file(file, doc.id)
        doc.file_path = file_path
        doc.file_name = file_name
        doc.file_size = file_size

    doc.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(snap)

    creator_result = await db.execute(select(User).where(User.id == snap.created_by))
    creator = creator_result.scalar_one_or_none()

    return VersionRead(
        id=snap.id,
        document_id=snap.document_id,
        version=snap.version,
        file_name=snap.file_name,
        change_notes=snap.change_notes,
        created_at=snap.created_at,
        creator_name=creator.full_name if creator else "未知",
    )


# ---------------------------------------------------------------------------
# File serving
# ---------------------------------------------------------------------------

@router.get("/files/{document_id}")
async def serve_file(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """下載文件附件"""
    result = await db.execute(
        select(SopDocument.file_path, SopDocument.file_name)
        .where(SopDocument.id == document_id, SopDocument.is_active == True)
    )
    row = result.first()
    if not row or not row.file_path:
        raise HTTPException(status_code=404, detail="該文件沒有附加檔案")

    file_path: str = row.file_path
    file_name: str = row.file_name or "download"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="檔案不存在於伺服器")

    def iterfile():
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )
