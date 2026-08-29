import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", DATA_DIR / "uploads"))

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "AutoTracker (LubeLogger Style)"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", f"sqlite+aiosqlite:///{DATA_DIR / 'autotracker.db'}"
    )
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["*"]

    class Config:
        case_sensitive = True

settings = Settings()
