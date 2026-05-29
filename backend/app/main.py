import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.config import settings
from app.database import create_tables, AsyncSessionLocal
from app.models.user import User, UserRole
from app.models import sop as _sop_models  # noqa: F401 – ensure SOP models are registered
from app.core.security import get_password_hash
from app.api.v1 import auth, users
from app.api.v1 import sop as sop_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure upload directory exists
    os.makedirs("/app/uploads/sop", exist_ok=True)
    # Create tables and seed default admin
    await create_tables()
    await seed_default_admin()
    yield
    # Shutdown (nothing to clean up for now)


async def seed_default_admin():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == UserRole.admin))
        existing_admin = result.scalar_one_or_none()
        if existing_admin is None:
            admin = User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                full_name=settings.DEFAULT_ADMIN_NAME,
                hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            print(f"[Startup] 已建立預設管理員帳號: {settings.DEFAULT_ADMIN_EMAIL}")
        else:
            print(f"[Startup] 管理員帳號已存在: {existing_admin.email}")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="半導體製程工程師管理系統 API",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(sop_router.router, prefix="/api/v1")


@app.get("/", tags=["健康檢查"])
async def root():
    return {"message": "FAB System API is running", "version": settings.APP_VERSION}


@app.get("/health", tags=["健康檢查"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
