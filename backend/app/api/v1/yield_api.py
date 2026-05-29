import csv
import io
import math
import statistics
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.deps import get_current_user
from app.models.yield_model import (
    YieldProduct, YieldStep, YieldRecord, YieldLossCategory, YieldLossRecord
)
from app.models.user import User, UserRole
from app.schemas.yield_schema import (
    ProductCreate, ProductRead, ProductUpdate,
    StepCreate, StepRead,
    LossCategoryCreate, LossCategoryRead,
    LossRecordRead,
    RecordCreate, RecordRead, RecordUpdate, RecordListResponse,
    TrendRecord, SpcData, SpcPoint, SummaryStats, ParetoItem, BulkImportResult,
)

router = APIRouter(prefix="/yield", tags=["良率分析"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _load_record(db: AsyncSession, record_id: uuid.UUID) -> Optional[YieldRecord]:
    result = await db.execute(
        select(YieldRecord)
        .options(
            selectinload(YieldRecord.product),
            selectinload(YieldRecord.step),
            selectinload(YieldRecord.creator),
            selectinload(YieldRecord.loss_records).selectinload(YieldLossRecord.category),
        )
        .where(YieldRecord.id == record_id)
    )
    return result.scalar_one_or_none()


def _record_to_read(rec: YieldRecord) -> RecordRead:
    loss_reads = [
        LossRecordRead(
            id=lr.id,
            category_id=lr.category_id,
            category_name=lr.category.name if lr.category else "未知",
            color=lr.category.color if lr.category else "#ff4d4f",
            loss_pct=lr.loss_pct,
            notes=lr.notes,
        )
        for lr in rec.loss_records
    ]
    return RecordRead(
        id=rec.id,
        lot_id=rec.lot_id,
        product_id=rec.product_id,
        product_name=rec.product.name if rec.product else "未知",
        product_code=rec.product.product_code if rec.product else "",
        step_id=rec.step_id,
        step_name=rec.step.name if rec.step else "未知",
        measurement_date=rec.measurement_date,
        yield_pct=rec.yield_pct,
        wafer_in=rec.wafer_in,
        wafer_out=rec.wafer_out,
        die_per_wafer=rec.die_per_wafer,
        good_die=rec.good_die,
        notes=rec.notes,
        loss_records=loss_reads,
        creator_name=rec.creator.full_name if rec.creator else "未知",
        created_at=rec.created_at,
    )


def _compute_spc(values: list[float], target: Optional[float] = None) -> dict:
    """Compute I-MR SPC statistics."""
    n = len(values)
    mean = statistics.mean(values)
    std = statistics.stdev(values) if n > 1 else 0.0
    ucl = mean + 3 * std
    lcl = max(0.0, mean - 3 * std)

    # Moving ranges
    mrs = [abs(values[i] - values[i - 1]) for i in range(1, n)]
    mr_mean = statistics.mean(mrs) if mrs else 0.0
    mr_ucl = 3.267 * mr_mean

    # Capability (USL=100, LSL=target)
    cp: Optional[float] = None
    cpk: Optional[float] = None
    if target is not None and std > 0:
        usl = 100.0
        lsl = float(target)
        cp = (usl - lsl) / (6 * std)
        cpk = min((usl - mean) / (3 * std), (mean - lsl) / (3 * std))

    return {
        "mean": mean,
        "std": std,
        "ucl": ucl,
        "lcl": lcl,
        "mr_mean": mr_mean,
        "mr_ucl": mr_ucl,
        "mrs": mrs,
        "cp": cp,
        "cpk": cpk,
    }


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

@router.get("/products", response_model=list[ProductRead])
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有啟用的產品"""
    result = await db.execute(
        select(YieldProduct).where(YieldProduct.is_active == True).order_by(YieldProduct.name)
    )
    return result.scalars().all()


@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立產品（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    dup_name = await db.execute(select(YieldProduct).where(YieldProduct.name == payload.name))
    if dup_name.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="產品名稱已存在")

    dup_code = await db.execute(
        select(YieldProduct).where(YieldProduct.product_code == payload.product_code)
    )
    if dup_code.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="產品代碼已存在")

    product = YieldProduct(
        name=payload.name,
        product_code=payload.product_code,
        description=payload.description,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新產品（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(YieldProduct).where(YieldProduct.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該產品")

    if payload.name is not None:
        dup = await db.execute(
            select(YieldProduct).where(YieldProduct.name == payload.name, YieldProduct.id != product_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="產品名稱已存在")
        product.name = payload.name

    if payload.product_code is not None:
        dup = await db.execute(
            select(YieldProduct).where(
                YieldProduct.product_code == payload.product_code, YieldProduct.id != product_id
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="產品代碼已存在")
        product.product_code = payload.product_code

    if payload.description is not None:
        product.description = payload.description
    if payload.is_active is not None:
        product.is_active = payload.is_active

    await db.commit()
    await db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

@router.get("/steps", response_model=list[StepRead])
async def list_steps(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有製程站點（依序列排序）"""
    result = await db.execute(
        select(YieldStep).order_by(YieldStep.sequence_order, YieldStep.name)
    )
    return result.scalars().all()


@router.post("/steps", response_model=StepRead, status_code=status.HTTP_201_CREATED)
async def create_step(
    payload: StepCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立製程站點（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    step = YieldStep(
        name=payload.name,
        sequence_order=payload.sequence_order,
        description=payload.description,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return step


# ---------------------------------------------------------------------------
# Loss Categories
# ---------------------------------------------------------------------------

@router.get("/loss-categories", response_model=list[LossCategoryRead])
async def list_loss_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有良率損失類別"""
    result = await db.execute(
        select(YieldLossCategory).order_by(YieldLossCategory.name)
    )
    return result.scalars().all()


@router.post("/loss-categories", response_model=LossCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_loss_category(
    payload: LossCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立良率損失類別（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    dup = await db.execute(select(YieldLossCategory).where(YieldLossCategory.name == payload.name))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="類別名稱已存在")

    cat = YieldLossCategory(
        name=payload.name,
        description=payload.description,
        color=payload.color,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ---------------------------------------------------------------------------
# Records
# ---------------------------------------------------------------------------

@router.get("/records", response_model=RecordListResponse)
async def list_records(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    product_id: Optional[uuid.UUID] = Query(None),
    step_id: Optional[uuid.UUID] = Query(None),
    lot_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    min_yield: Optional[float] = Query(None, ge=0, le=100),
    max_yield: Optional[float] = Query(None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出良率記錄（含分頁、篩選）"""
    stmt = select(YieldRecord)
    if product_id:
        stmt = stmt.where(YieldRecord.product_id == product_id)
    if step_id:
        stmt = stmt.where(YieldRecord.step_id == step_id)
    if lot_id:
        stmt = stmt.where(YieldRecord.lot_id.ilike(f"%{lot_id}%"))
    if start_date:
        stmt = stmt.where(YieldRecord.measurement_date >= start_date)
    if end_date:
        stmt = stmt.where(YieldRecord.measurement_date <= end_date)
    if min_yield is not None:
        stmt = stmt.where(YieldRecord.yield_pct >= min_yield)
    if max_yield is not None:
        stmt = stmt.where(YieldRecord.yield_pct <= max_yield)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    offset = (page - 1) * size
    paged_stmt = (
        stmt
        .options(
            selectinload(YieldRecord.product),
            selectinload(YieldRecord.step),
            selectinload(YieldRecord.creator),
            selectinload(YieldRecord.loss_records).selectinload(YieldLossRecord.category),
        )
        .order_by(YieldRecord.measurement_date.desc(), YieldRecord.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    result = await db.execute(paged_stmt)
    records = result.scalars().all()

    return RecordListResponse(
        items=[_record_to_read(r) for r in records],
        total=total,
        page=page,
        size=size,
    )


@router.post("/records", response_model=RecordRead, status_code=status.HTTP_201_CREATED)
async def create_record(
    payload: RecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增良率記錄（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    # Validate product
    prod_res = await db.execute(
        select(YieldProduct).where(YieldProduct.id == payload.product_id, YieldProduct.is_active == True)
    )
    if not prod_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該產品")

    # Validate step
    step_res = await db.execute(select(YieldStep).where(YieldStep.id == payload.step_id))
    if not step_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該製程站點")

    record = YieldRecord(
        lot_id=payload.lot_id,
        product_id=payload.product_id,
        step_id=payload.step_id,
        measurement_date=payload.measurement_date,
        yield_pct=payload.yield_pct,
        wafer_in=payload.wafer_in,
        wafer_out=payload.wafer_out,
        die_per_wafer=payload.die_per_wafer,
        good_die=payload.good_die,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(record)
    await db.flush()

    # Loss records
    for lr_input in payload.loss_records:
        cat_res = await db.execute(
            select(YieldLossCategory).where(YieldLossCategory.id == lr_input.category_id)
        )
        if not cat_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"找不到損失類別 {lr_input.category_id}",
            )
        lr = YieldLossRecord(
            yield_record_id=record.id,
            category_id=lr_input.category_id,
            loss_pct=lr_input.loss_pct,
            notes=lr_input.notes,
        )
        db.add(lr)

    await db.commit()
    record = await _load_record(db, record.id)
    return _record_to_read(record)


@router.get("/records/{record_id}", response_model=RecordRead)
async def get_record(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得良率記錄詳情"""
    record = await _load_record(db, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該記錄")
    return _record_to_read(record)


@router.put("/records/{record_id}", response_model=RecordRead)
async def update_record(
    record_id: uuid.UUID,
    payload: RecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新良率記錄（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(YieldRecord).where(YieldRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該記錄")

    if payload.lot_id is not None:
        record.lot_id = payload.lot_id
    if payload.measurement_date is not None:
        record.measurement_date = payload.measurement_date
    if payload.yield_pct is not None:
        record.yield_pct = payload.yield_pct
    if payload.wafer_in is not None:
        record.wafer_in = payload.wafer_in
    if payload.wafer_out is not None:
        record.wafer_out = payload.wafer_out
    if payload.die_per_wafer is not None:
        record.die_per_wafer = payload.die_per_wafer
    if payload.good_die is not None:
        record.good_die = payload.good_die
    if payload.notes is not None:
        record.notes = payload.notes

    await db.commit()
    record = await _load_record(db, record_id)
    return _record_to_read(record)


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """刪除良率記錄（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除記錄")

    result = await db.execute(select(YieldRecord).where(YieldRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該記錄")

    await db.delete(record)
    await db.commit()


@router.post("/records/import", response_model=BulkImportResult)
async def import_records_csv(
    file: UploadFile = File(..., description="CSV 檔案"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批次匯入良率記錄（CSV）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("big5", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        return BulkImportResult(success_count=0, error_count=0, errors=["CSV 檔案為空或格式錯誤"])

    fieldnames = [f.strip() for f in reader.fieldnames]
    required = {"lot_id", "measurement_date", "product_code", "step_name", "yield_pct"}
    if not required.issubset(set(fieldnames)):
        return BulkImportResult(
            success_count=0,
            error_count=0,
            errors=[f"CSV 缺少必要欄位，需要: {', '.join(required)}"],
        )

    # Caches
    product_cache: dict[str, Optional[YieldProduct]] = {}
    step_cache: dict[str, Optional[YieldStep]] = {}

    async def get_product_by_code(code: str) -> Optional[YieldProduct]:
        if code in product_cache:
            return product_cache[code]
        res = await db.execute(
            select(YieldProduct).where(YieldProduct.product_code == code, YieldProduct.is_active == True)
        )
        p = res.scalar_one_or_none()
        product_cache[code] = p
        return p

    async def get_step_by_name(name: str) -> Optional[YieldStep]:
        if name in step_cache:
            return step_cache[name]
        res = await db.execute(select(YieldStep).where(YieldStep.name == name))
        s = res.scalar_one_or_none()
        step_cache[name] = s
        return s

    success_count = 0
    error_count = 0
    errors: list[str] = []

    for row_num, raw_row in enumerate(reader, start=2):
        row = {k.strip(): (v.strip() if v else "") for k, v in raw_row.items() if k}
        try:
            lot_id = row.get("lot_id", "").strip()
            date_str = row.get("measurement_date", "").strip()
            product_code = row.get("product_code", "").strip()
            step_name = row.get("step_name", "").strip()
            yield_pct_str = row.get("yield_pct", "").strip()

            if not lot_id:
                raise ValueError("lot_id 不得為空")
            if not date_str:
                raise ValueError("measurement_date 不得為空")
            if not product_code:
                raise ValueError("product_code 不得為空")
            if not step_name:
                raise ValueError("step_name 不得為空")
            if not yield_pct_str:
                raise ValueError("yield_pct 不得為空")

            try:
                mdate = date.fromisoformat(date_str)
            except ValueError:
                raise ValueError(f"measurement_date 格式錯誤（應為 YYYY-MM-DD）: {date_str}")

            try:
                yield_pct = float(yield_pct_str)
                if not 0 <= yield_pct <= 100:
                    raise ValueError("良率應介於 0-100")
            except ValueError as e:
                raise ValueError(f"yield_pct 值錯誤: {e}")

            product = await get_product_by_code(product_code)
            if not product:
                raise ValueError(f"找不到產品代碼: {product_code}")

            step = await get_step_by_name(step_name)
            if not step:
                raise ValueError(f"找不到製程站點: {step_name}")

            wafer_in = None
            if row.get("wafer_in"):
                try:
                    wafer_in = int(row["wafer_in"])
                except ValueError:
                    pass

            record = YieldRecord(
                lot_id=lot_id,
                product_id=product.id,
                step_id=step.id,
                measurement_date=mdate,
                yield_pct=yield_pct,
                wafer_in=wafer_in,
                notes=row.get("notes") or None,
                created_by=current_user.id,
            )
            db.add(record)
            await db.commit()
            success_count += 1

        except Exception as exc:
            await db.rollback()
            error_count += 1
            errors.append(f"第 {row_num} 行: {str(exc)}")

    return BulkImportResult(success_count=success_count, error_count=error_count, errors=errors)


# ---------------------------------------------------------------------------
# Analytics: Trend
# ---------------------------------------------------------------------------

@router.get("/trend", response_model=list[TrendRecord])
async def get_trend(
    product_id: uuid.UUID = Query(...),
    step_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得良率趨勢資料（依日期排序）"""
    stmt = select(YieldRecord).where(YieldRecord.product_id == product_id)
    if step_id:
        stmt = stmt.where(YieldRecord.step_id == step_id)
    if start_date:
        stmt = stmt.where(YieldRecord.measurement_date >= start_date)
    if end_date:
        stmt = stmt.where(YieldRecord.measurement_date <= end_date)
    stmt = stmt.order_by(YieldRecord.measurement_date, YieldRecord.created_at)

    result = await db.execute(stmt)
    records = result.scalars().all()

    return [
        TrendRecord(
            record_id=r.id,
            lot_id=r.lot_id,
            date=r.measurement_date,
            yield_pct=r.yield_pct,
        )
        for r in records
    ]


# ---------------------------------------------------------------------------
# Analytics: SPC
# ---------------------------------------------------------------------------

@router.get("/spc", response_model=SpcData)
async def get_spc(
    product_id: uuid.UUID = Query(...),
    step_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    target: Optional[float] = Query(None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """計算 I-MR 管制圖（Statistical Process Control）"""
    stmt = select(YieldRecord).where(YieldRecord.product_id == product_id)
    if step_id:
        stmt = stmt.where(YieldRecord.step_id == step_id)
    if start_date:
        stmt = stmt.where(YieldRecord.measurement_date >= start_date)
    if end_date:
        stmt = stmt.where(YieldRecord.measurement_date <= end_date)
    stmt = stmt.order_by(YieldRecord.measurement_date, YieldRecord.created_at)

    result = await db.execute(stmt)
    records = result.scalars().all()

    if len(records) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="至少需要 2 筆資料才能計算管制圖",
        )

    values = [r.yield_pct for r in records]
    spc = _compute_spc(values, target)

    # Build points with out-of-control flag (Western Electric Rule 1: beyond 3σ)
    points = []
    for i, r in enumerate(records):
        mr_val = spc["mrs"][i - 1] if i > 0 else None
        out_of_control = r.yield_pct > spc["ucl"] or r.yield_pct < spc["lcl"]
        points.append(
            SpcPoint(
                lot_id=r.lot_id,
                date=r.measurement_date,
                value=r.yield_pct,
                mr=mr_val,
                out_of_control=out_of_control,
            )
        )

    return SpcData(
        points=points,
        mean=spc["mean"],
        std=spc["std"],
        ucl=spc["ucl"],
        lcl=spc["lcl"],
        mr_ucl=spc["mr_ucl"],
        cp=spc["cp"],
        cpk=spc["cpk"],
    )


# ---------------------------------------------------------------------------
# Analytics: Summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=SummaryStats)
async def get_summary(
    product_id: uuid.UUID = Query(...),
    step_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    target: Optional[float] = Query(None, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得良率統計摘要（含 Cp/Cpk）"""
    stmt = select(YieldRecord.yield_pct).where(YieldRecord.product_id == product_id)
    if step_id:
        stmt = stmt.where(YieldRecord.step_id == step_id)
    if start_date:
        stmt = stmt.where(YieldRecord.measurement_date >= start_date)
    if end_date:
        stmt = stmt.where(YieldRecord.measurement_date <= end_date)

    result = await db.execute(stmt)
    values = [row[0] for row in result.all()]

    if not values:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="無資料可計算統計",
        )

    n = len(values)
    sorted_vals = sorted(values)
    mean = statistics.mean(values)
    std = statistics.stdev(values) if n > 1 else 0.0

    def percentile(data: list[float], p: float) -> float:
        if len(data) == 1:
            return data[0]
        idx = (len(data) - 1) * p
        lo = math.floor(idx)
        hi = math.ceil(idx)
        if lo == hi:
            return data[lo]
        return data[lo] + (data[hi] - data[lo]) * (idx - lo)

    cp: Optional[float] = None
    cpk: Optional[float] = None
    if target is not None and std > 0:
        usl = 100.0
        lsl = float(target)
        cp = (usl - lsl) / (6 * std)
        cpk = min((usl - mean) / (3 * std), (mean - lsl) / (3 * std))

    return SummaryStats(
        count=n,
        mean=round(mean, 4),
        std=round(std, 4),
        min=sorted_vals[0],
        max=sorted_vals[-1],
        p25=round(percentile(sorted_vals, 0.25), 4),
        p50=round(percentile(sorted_vals, 0.50), 4),
        p75=round(percentile(sorted_vals, 0.75), 4),
        cp=round(cp, 4) if cp is not None else None,
        cpk=round(cpk, 4) if cpk is not None else None,
        yield_target=target,
    )


# ---------------------------------------------------------------------------
# Analytics: Pareto
# ---------------------------------------------------------------------------

@router.get("/pareto", response_model=list[ParetoItem])
async def get_pareto(
    product_id: uuid.UUID = Query(...),
    step_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得良率損失柏拉圖資料"""
    # Get record IDs matching filters
    rec_stmt = select(YieldRecord.id).where(YieldRecord.product_id == product_id)
    if step_id:
        rec_stmt = rec_stmt.where(YieldRecord.step_id == step_id)
    if start_date:
        rec_stmt = rec_stmt.where(YieldRecord.measurement_date >= start_date)
    if end_date:
        rec_stmt = rec_stmt.where(YieldRecord.measurement_date <= end_date)

    rec_result = await db.execute(rec_stmt)
    record_ids = [row[0] for row in rec_result.all()]

    if not record_ids:
        return []

    # Aggregate loss records
    lr_stmt = (
        select(
            YieldLossCategory.name,
            YieldLossCategory.color,
            func.sum(YieldLossRecord.loss_pct).label("total_loss"),
            func.count(YieldLossRecord.id).label("rec_count"),
        )
        .join(YieldLossRecord, YieldLossRecord.category_id == YieldLossCategory.id)
        .where(YieldLossRecord.yield_record_id.in_(record_ids))
        .group_by(YieldLossCategory.id, YieldLossCategory.name, YieldLossCategory.color)
        .order_by(func.sum(YieldLossRecord.loss_pct).desc())
    )

    result = await db.execute(lr_stmt)
    rows = result.all()

    return [
        ParetoItem(
            category_name=row.name,
            color=row.color,
            total_loss_pct=round(row.total_loss, 4),
            record_count=row.rec_count,
        )
        for row in rows
    ]
