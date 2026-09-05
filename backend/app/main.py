from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings, UPLOAD_DIR
from app.db.session import init_db
from app.api import (
    auth,
    vehicles,
    service,
    fuel,
    reminders,
    documents,
    analytics,
    export,
    uploads,
    tyres,
    consumables,
    backup,
    telematics,
    telegram,
    public,
    ocr,
)
from app.services.telematics_scheduler import start_telematics_background_worker
from app.services.telegram_service import start_telegram_bot_worker
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    # Start background workers
    scheduler_task = asyncio.create_task(start_telematics_background_worker())
    telegram_task = asyncio.create_task(start_telegram_bot_worker())
    yield
    scheduler_task.cancel()
    telegram_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include Routers
api_v1_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(vehicles.router, prefix=api_v1_prefix)
app.include_router(service.router, prefix=api_v1_prefix)
app.include_router(fuel.router, prefix=api_v1_prefix)
app.include_router(reminders.router, prefix=api_v1_prefix)
app.include_router(documents.router, prefix=api_v1_prefix)
app.include_router(analytics.router, prefix=api_v1_prefix)
app.include_router(export.router, prefix=api_v1_prefix)
app.include_router(uploads.router, prefix=api_v1_prefix)
app.include_router(tyres.router, prefix=api_v1_prefix)
app.include_router(consumables.router, prefix=api_v1_prefix)
app.include_router(backup.router, prefix=api_v1_prefix)
app.include_router(telematics.router, prefix=api_v1_prefix)
app.include_router(telegram.router, prefix=api_v1_prefix)
app.include_router(public.router, prefix=api_v1_prefix)
app.include_router(ocr.router, prefix=api_v1_prefix)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": settings.VERSION}

# Serve Frontend static build if exists
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}

if STATIC_DIR.exists():
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # 1. Root or index.html
        if not full_path or full_path == "index.html":
            index_path = STATIC_DIR / "index.html"
            if index_path.exists():
                return FileResponse(index_path, headers=NO_CACHE_HEADERS)

        # 2. Service Worker or manifest
        if full_path in ("sw.js", "manifest.json"):
            target_path = STATIC_DIR / full_path
            if target_path.exists():
                return FileResponse(target_path, headers=NO_CACHE_HEADERS)

        # 3. Direct static file match
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            # For assets (hashed CSS/JS/images), allow browser caching
            return FileResponse(file_path)

        # 4. Fallback for outdated hashed assets: if client requested old JS/CSS, serve the latest matching asset
        if full_path.startswith("assets/"):
            assets_dir = STATIC_DIR / "assets"
            if assets_dir.exists():
                if full_path.endswith(".js"):
                    js_files = list(assets_dir.glob("index-*.js"))
                    if js_files:
                        return FileResponse(js_files[0], headers=NO_CACHE_HEADERS)
                elif full_path.endswith(".css"):
                    css_files = list(assets_dir.glob("index-*.css"))
                    if css_files:
                        return FileResponse(css_files[0], headers=NO_CACHE_HEADERS)

        # 5. Default SPA fallback
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path, headers=NO_CACHE_HEADERS)
        return FileResponse(file_path)
