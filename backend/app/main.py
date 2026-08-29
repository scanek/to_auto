from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings, UPLOAD_DIR
from app.db.session import init_db
from app.api import (
    vehicles,
    service,
    fuel,
    reminders,
    documents,
    analytics,
    export,
    uploads,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
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
app.include_router(vehicles.router, prefix=api_v1_prefix)
app.include_router(service.router, prefix=api_v1_prefix)
app.include_router(fuel.router, prefix=api_v1_prefix)
app.include_router(reminders.router, prefix=api_v1_prefix)
app.include_router(documents.router, prefix=api_v1_prefix)
app.include_router(analytics.router, prefix=api_v1_prefix)
app.include_router(export.router, prefix=api_v1_prefix)
app.include_router(uploads.router, prefix=api_v1_prefix)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": settings.VERSION}

# Serve Frontend static build if exists (for unified single-container Docker setup)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
