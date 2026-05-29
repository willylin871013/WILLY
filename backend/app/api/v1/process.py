import csv
import io
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.deps import get_current_user
from app.models.process import ProcessRecipe, ProcessParameter, ProcessRun, ProcessMeasurement
from app.models.user import User, UserRole
from app.schemas.process import (
    RecipeCreate, RecipeRead, RecipeListItem, RecipeUpdate,
    ParameterCreate, ParameterRead, ParameterUpdate,
    RunCreate, RunRead, RunListItem, RunListResponse, RunUpdate,
    BulkImportResult, TrendPoint,
    MeasurementRead,
)

router = APIRouter(prefix="/process", tags=["製程參數管理"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _compute_out_of_spec(value: float, spec_min: Optional[float], spec_max: Optional[float]) -> bool:
    if spec_min is not None and value < spec_min:
        return True
    if spec_max is not None and value > spec_max:
        return True
    return False


async def _load_recipe(db: AsyncSession, recipe_id: uuid.UUID, active_only: bool = True) -> Optional[ProcessRecipe]:
    conds = [ProcessRecipe.id == recipe_id]
    if active_only:
        conds.append(ProcessRecipe.is_active == True)
    result = await db.execute(
        select(ProcessRecipe)
        .options(
            selectinload(ProcessRecipe.creator),
            selectinload(ProcessRecipe.parameters),
        )
        .where(*conds)
    )
    return result.scalar_one_or_none()


def _recipe_to_read(recipe: ProcessRecipe) -> RecipeRead:
    params = [
        ParameterRead(
            id=p.id,
            recipe_id=p.recipe_id,
            name=p.name,
            unit=p.unit,
            spec_min=p.spec_min,
            spec_max=p.spec_max,
            target=p.target,
            display_order=p.display_order,
        )
        for p in sorted(recipe.parameters, key=lambda x: x.display_order)
    ]
    return RecipeRead(
        id=recipe.id,
        name=recipe.name,
        description=recipe.description,
        process_type=recipe.process_type,
        parameters=params,
        creator_name=recipe.creator.full_name if recipe.creator else "未知",
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
        is_active=recipe.is_active,
    )


async def _load_run(db: AsyncSession, run_id: uuid.UUID) -> Optional[ProcessRun]:
    result = await db.execute(
        select(ProcessRun)
        .options(
            selectinload(ProcessRun.recipe),
            selectinload(ProcessRun.operator),
            selectinload(ProcessRun.creator),
            selectinload(ProcessRun.measurements).selectinload(ProcessMeasurement.parameter),
        )
        .where(ProcessRun.id == run_id)
    )
    return result.scalar_one_or_none()


def _run_to_read(run: ProcessRun) -> RunRead:
    measurements = [
        MeasurementRead(
            id=m.id,
            parameter_id=m.parameter_id,
            parameter_name=m.parameter.name if m.parameter else "",
            unit=m.parameter.unit if m.parameter else None,
            spec_min=m.parameter.spec_min if m.parameter else None,
            spec_max=m.parameter.spec_max if m.parameter else None,
            target=m.parameter.target if m.parameter else None,
            value=m.value,
            is_out_of_spec=m.is_out_of_spec,
        )
        for m in run.measurements
    ]
    oos_count = sum(1 for m in measurements if m.is_out_of_spec)
    return RunRead(
        id=run.id,
        recipe_id=run.recipe_id,
        recipe_name=run.recipe.name if run.recipe else "未知",
        lot_id=run.lot_id,
        run_date=run.run_date,
        operator_name=run.operator.full_name if run.operator else None,
        notes=run.notes,
        measurements=measurements,
        out_of_spec_count=oos_count,
        created_at=run.created_at,
    )


# ---------------------------------------------------------------------------
# Recipes
# ---------------------------------------------------------------------------

@router.get("/recipes", response_model=list[RecipeListItem])
async def list_recipes(
    process_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有製程配方"""
    stmt = select(ProcessRecipe).where(ProcessRecipe.is_active == True)
    if process_type:
        stmt = stmt.where(ProcessRecipe.process_type == process_type)
    if search:
        stmt = stmt.where(ProcessRecipe.name.ilike(f"%{search}%"))
    stmt = stmt.options(
        selectinload(ProcessRecipe.creator),
        selectinload(ProcessRecipe.parameters),
    ).order_by(ProcessRecipe.name)

    result = await db.execute(stmt)
    recipes = result.scalars().all()

    return [
        RecipeListItem(
            id=r.id,
            name=r.name,
            description=r.description,
            process_type=r.process_type,
            parameter_count=len(r.parameters),
            creator_name=r.creator.full_name if r.creator else "未知",
            created_at=r.created_at,
            updated_at=r.updated_at,
            is_active=r.is_active,
        )
        for r in recipes
    ]


@router.post("/recipes", response_model=RecipeRead, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    payload: RecipeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """建立製程配方（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    existing = await db.execute(
        select(ProcessRecipe).where(ProcessRecipe.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="配方名稱已存在")

    recipe = ProcessRecipe(
        name=payload.name,
        description=payload.description,
        process_type=payload.process_type,
        created_by=current_user.id,
    )
    db.add(recipe)
    await db.flush()

    for i, param in enumerate(payload.parameters):
        p = ProcessParameter(
            recipe_id=recipe.id,
            name=param.name,
            unit=param.unit,
            spec_min=param.spec_min,
            spec_max=param.spec_max,
            target=param.target,
            display_order=param.display_order if param.display_order else i,
        )
        db.add(p)

    await db.commit()
    recipe = await _load_recipe(db, recipe.id)
    return _recipe_to_read(recipe)


@router.get("/recipes/{recipe_id}", response_model=RecipeRead)
async def get_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得配方詳情（含參數列表）"""
    recipe = await _load_recipe(db, recipe_id)
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該配方")
    return _recipe_to_read(recipe)


@router.put("/recipes/{recipe_id}", response_model=RecipeRead)
async def update_recipe(
    recipe_id: uuid.UUID,
    payload: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新配方資訊（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(
        select(ProcessRecipe).where(ProcessRecipe.id == recipe_id, ProcessRecipe.is_active == True)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該配方")

    if payload.name is not None:
        # Check uniqueness
        dup = await db.execute(
            select(ProcessRecipe).where(
                ProcessRecipe.name == payload.name,
                ProcessRecipe.id != recipe_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="配方名稱已存在")
        recipe.name = payload.name
    if payload.description is not None:
        recipe.description = payload.description
    if payload.process_type is not None:
        recipe.process_type = payload.process_type
    if payload.is_active is not None:
        recipe.is_active = payload.is_active

    recipe.updated_at = datetime.utcnow()
    await db.commit()

    recipe = await _load_recipe(db, recipe_id, active_only=False)
    return _recipe_to_read(recipe)


@router.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """軟刪除配方（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除配方")

    result = await db.execute(
        select(ProcessRecipe).where(ProcessRecipe.id == recipe_id, ProcessRecipe.is_active == True)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該配方")

    recipe.is_active = False
    recipe.updated_at = datetime.utcnow()
    await db.commit()


# ---------------------------------------------------------------------------
# Parameters (nested under recipe)
# ---------------------------------------------------------------------------

@router.post(
    "/recipes/{recipe_id}/parameters",
    response_model=ParameterRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_parameter(
    recipe_id: uuid.UUID,
    payload: ParameterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增配方參數（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    recipe_check = await db.execute(
        select(ProcessRecipe.id).where(ProcessRecipe.id == recipe_id, ProcessRecipe.is_active == True)
    )
    if not recipe_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該配方")

    param = ProcessParameter(
        recipe_id=recipe_id,
        name=payload.name,
        unit=payload.unit,
        spec_min=payload.spec_min,
        spec_max=payload.spec_max,
        target=payload.target,
        display_order=payload.display_order,
    )
    db.add(param)
    await db.commit()
    await db.refresh(param)

    return ParameterRead(
        id=param.id,
        recipe_id=param.recipe_id,
        name=param.name,
        unit=param.unit,
        spec_min=param.spec_min,
        spec_max=param.spec_max,
        target=param.target,
        display_order=param.display_order,
    )


@router.put("/parameters/{parameter_id}", response_model=ParameterRead)
async def update_parameter(
    parameter_id: uuid.UUID,
    payload: ParameterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新參數定義（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(
        select(ProcessParameter).where(ProcessParameter.id == parameter_id)
    )
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該參數")

    if payload.name is not None:
        param.name = payload.name
    if payload.unit is not None:
        param.unit = payload.unit
    if payload.spec_min is not None:
        param.spec_min = payload.spec_min
    if payload.spec_max is not None:
        param.spec_max = payload.spec_max
    if payload.target is not None:
        param.target = payload.target
    if payload.display_order is not None:
        param.display_order = payload.display_order

    await db.commit()
    await db.refresh(param)

    return ParameterRead(
        id=param.id,
        recipe_id=param.recipe_id,
        name=param.name,
        unit=param.unit,
        spec_min=param.spec_min,
        spec_max=param.spec_max,
        target=param.target,
        display_order=param.display_order,
    )


@router.delete("/parameters/{parameter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parameter(
    parameter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """刪除參數（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除參數")

    result = await db.execute(
        select(ProcessParameter).where(ProcessParameter.id == parameter_id)
    )
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該參數")

    await db.delete(param)
    await db.commit()


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------

@router.get("/runs", response_model=RunListResponse)
async def list_runs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    recipe_id: Optional[uuid.UUID] = Query(None),
    lot_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    has_out_of_spec: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出量測記錄（含分頁、篩選）"""
    stmt = select(ProcessRun)
    if recipe_id:
        stmt = stmt.where(ProcessRun.recipe_id == recipe_id)
    if lot_id:
        stmt = stmt.where(ProcessRun.lot_id.ilike(f"%{lot_id}%"))
    if start_date:
        stmt = stmt.where(ProcessRun.run_date >= start_date)
    if end_date:
        stmt = stmt.where(ProcessRun.run_date <= end_date)

    # Count total first (without pagination or measurement filter since we need subquery)
    # For has_out_of_spec we filter after loading or use subquery
    if has_out_of_spec is True:
        oos_subq = (
            select(ProcessMeasurement.run_id)
            .where(ProcessMeasurement.is_out_of_spec == True)
            .distinct()
            .scalar_subquery()
        )
        stmt = stmt.where(ProcessRun.id.in_(oos_subq))
    elif has_out_of_spec is False:
        oos_subq = (
            select(ProcessMeasurement.run_id)
            .where(ProcessMeasurement.is_out_of_spec == True)
            .distinct()
            .scalar_subquery()
        )
        stmt = stmt.where(ProcessRun.id.not_in(oos_subq))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    offset = (page - 1) * size
    paged_stmt = (
        stmt
        .options(
            selectinload(ProcessRun.recipe),
            selectinload(ProcessRun.operator),
            selectinload(ProcessRun.measurements),
        )
        .order_by(ProcessRun.run_date.desc(), ProcessRun.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    result = await db.execute(paged_stmt)
    runs = result.scalars().all()

    items = []
    for run in runs:
        oos_count = sum(1 for m in run.measurements if m.is_out_of_spec)
        items.append(
            RunListItem(
                id=run.id,
                recipe_id=run.recipe_id,
                recipe_name=run.recipe.name if run.recipe else "未知",
                lot_id=run.lot_id,
                run_date=run.run_date,
                operator_name=run.operator.full_name if run.operator else None,
                notes=run.notes,
                out_of_spec_count=oos_count,
                created_at=run.created_at,
            )
        )

    return RunListResponse(items=items, total=total, page=page, size=size)


@router.get("/runs/trend", response_model=list[TrendPoint])
async def get_trend(
    recipe_id: uuid.UUID = Query(...),
    parameter_id: uuid.UUID = Query(...),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得趨勢資料（供折線圖使用）"""
    stmt = (
        select(ProcessRun, ProcessMeasurement)
        .join(ProcessMeasurement, ProcessMeasurement.run_id == ProcessRun.id)
        .where(
            ProcessRun.recipe_id == recipe_id,
            ProcessMeasurement.parameter_id == parameter_id,
        )
    )
    if start_date:
        stmt = stmt.where(ProcessRun.run_date >= start_date)
    if end_date:
        stmt = stmt.where(ProcessRun.run_date <= end_date)

    stmt = stmt.order_by(ProcessRun.run_date.desc(), ProcessRun.created_at.desc()).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    # Reverse to show oldest first for charting
    points = [
        TrendPoint(
            run_id=run.id,
            lot_id=run.lot_id,
            run_date=run.run_date,
            value=meas.value,
            is_out_of_spec=meas.is_out_of_spec,
        )
        for run, meas in reversed(rows)
    ]
    return points


@router.post("/runs", response_model=RunRead, status_code=status.HTTP_201_CREATED)
async def create_run(
    payload: RunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """新增量測記錄（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    # Validate recipe exists
    recipe_result = await db.execute(
        select(ProcessRecipe)
        .options(selectinload(ProcessRecipe.parameters))
        .where(ProcessRecipe.id == payload.recipe_id, ProcessRecipe.is_active == True)
    )
    recipe = recipe_result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該配方")

    # Validate operator if provided
    if payload.operator_id is not None:
        op_result = await db.execute(select(User.id).where(User.id == payload.operator_id))
        if not op_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到指定操作員")

    run = ProcessRun(
        recipe_id=payload.recipe_id,
        lot_id=payload.lot_id,
        run_date=payload.run_date,
        operator_id=payload.operator_id,
        notes=payload.notes,
        created_by=current_user.id,
    )
    db.add(run)
    await db.flush()

    # Build parameter lookup
    param_map = {p.id: p for p in recipe.parameters}

    for m_input in payload.measurements:
        param = param_map.get(m_input.parameter_id)
        if not param:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"參數 {m_input.parameter_id} 不屬於此配方",
            )
        oos = _compute_out_of_spec(m_input.value, param.spec_min, param.spec_max)
        meas = ProcessMeasurement(
            run_id=run.id,
            parameter_id=m_input.parameter_id,
            value=m_input.value,
            is_out_of_spec=oos,
        )
        db.add(meas)

    await db.commit()

    run = await _load_run(db, run.id)
    return _run_to_read(run)


@router.get("/runs/{run_id}", response_model=RunRead)
async def get_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """取得量測記錄詳情"""
    run = await _load_run(db, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該記錄")
    return _run_to_read(run)


@router.put("/runs/{run_id}", response_model=RunRead)
async def update_run(
    run_id: uuid.UUID,
    payload: RunUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新量測記錄備註/操作員（工程師以上）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    result = await db.execute(select(ProcessRun).where(ProcessRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該記錄")

    if payload.notes is not None:
        run.notes = payload.notes
    if payload.operator_id is not None:
        run.operator_id = payload.operator_id

    await db.commit()
    run = await _load_run(db, run_id)
    return _run_to_read(run)


@router.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """刪除量測記錄（管理員）"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理員可刪除記錄")

    result = await db.execute(select(ProcessRun).where(ProcessRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到該記錄")

    await db.delete(run)
    await db.commit()


# ---------------------------------------------------------------------------
# CSV Import
# ---------------------------------------------------------------------------

@router.post("/runs/import", response_model=BulkImportResult)
async def import_runs_csv(
    file: UploadFile = File(..., description="CSV 檔案"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批次匯入量測記錄（CSV）"""
    if current_user.role == UserRole.readonly:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足，需要工程師以上角色")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text = content.decode("big5", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        return BulkImportResult(success_count=0, error_count=0, errors=["CSV 檔案為空或格式錯誤"])

    fieldnames = [f.strip() for f in reader.fieldnames]
    required = {"lot_id", "run_date", "recipe_name"}
    if not required.issubset(set(fieldnames)):
        return BulkImportResult(
            success_count=0,
            error_count=0,
            errors=[f"CSV 缺少必要欄位，需要: {', '.join(required)}"],
        )

    # Cache recipes
    recipe_cache: dict[str, ProcessRecipe] = {}

    async def get_recipe_by_name(name: str) -> Optional[ProcessRecipe]:
        if name in recipe_cache:
            return recipe_cache[name]
        res = await db.execute(
            select(ProcessRecipe)
            .options(selectinload(ProcessRecipe.parameters))
            .where(ProcessRecipe.name == name, ProcessRecipe.is_active == True)
        )
        r = res.scalar_one_or_none()
        if r:
            recipe_cache[name] = r
        return r

    success_count = 0
    error_count = 0
    errors: list[str] = []

    for row_num, raw_row in enumerate(reader, start=2):
        row = {k.strip(): (v.strip() if v else "") for k, v in raw_row.items()}
        try:
            lot_id = row.get("lot_id", "").strip()
            run_date_str = row.get("run_date", "").strip()
            recipe_name = row.get("recipe_name", "").strip()

            if not lot_id:
                raise ValueError("lot_id 不得為空")
            if not run_date_str:
                raise ValueError("run_date 不得為空")
            if not recipe_name:
                raise ValueError("recipe_name 不得為空")

            try:
                run_date = date.fromisoformat(run_date_str)
            except ValueError:
                raise ValueError(f"run_date 格式錯誤（應為 YYYY-MM-DD）: {run_date_str}")

            recipe = await get_recipe_by_name(recipe_name)
            if not recipe:
                raise ValueError(f"找不到配方: {recipe_name}")

            param_map = {p.name: p for p in recipe.parameters}

            run = ProcessRun(
                recipe_id=recipe.id,
                lot_id=lot_id,
                run_date=run_date,
                notes=row.get("notes") or None,
                created_by=current_user.id,
            )
            db.add(run)
            await db.flush()

            for col_name, col_val in row.items():
                if col_name in ("lot_id", "run_date", "recipe_name", "notes"):
                    continue
                if not col_val:
                    continue
                param = param_map.get(col_name)
                if not param:
                    continue  # skip unknown columns silently
                try:
                    value = float(col_val)
                except ValueError:
                    raise ValueError(f"參數 '{col_name}' 值非數字: {col_val}")

                oos = _compute_out_of_spec(value, param.spec_min, param.spec_max)
                meas = ProcessMeasurement(
                    run_id=run.id,
                    parameter_id=param.id,
                    value=value,
                    is_out_of_spec=oos,
                )
                db.add(meas)

            await db.commit()
            success_count += 1

        except Exception as exc:
            await db.rollback()
            error_count += 1
            errors.append(f"第 {row_num} 行: {str(exc)}")

    return BulkImportResult(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
    )
