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
    VERSION: str = "2.9.2"
    API_V1_STR: str = "/api/v1"
    
    # Paths
    DATA_DIR: Path = DATA_DIR
    UPLOAD_DIR: Path = UPLOAD_DIR
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", f"sqlite+aiosqlite:///{DATA_DIR / 'autotracker.db'}"
    )
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["*"]

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "8868283738:AAG3Dh994OcZ1SxHjRuWekoJQgH4vhkZXyA")
    TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "to_scanek_bot")

    # Swagger / OpenAPI documentation
    ENABLE_DOCS: bool = os.getenv("ENABLE_DOCS", "false").lower() in ("true", "1", "yes")

    class Config:
        case_sensitive = True

settings = Settings()
