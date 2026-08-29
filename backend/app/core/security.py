import os
import hmac
import hashlib
from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.setting import Setting
from app.core.config import settings

SECRET_KEY = os.getenv("SECRET_KEY", "autotracker-super-secret-salt-key-2026")
DEFAULT_ENV_PIN = os.getenv("MASTER_PIN", "")

def hash_pin(pin: str) -> str:
    """Hash PIN with secret salt."""
    return hashlib.sha256(f"{SECRET_KEY}:{pin}".encode("utf-8")).hexdigest()

def verify_pin_str(pin: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_pin(pin), hashed)

async def get_db_pin_hash(db: AsyncSession) -> Optional[str]:
    res = await db.execute(select(Setting).where(Setting.key == "master_pin_hash"))
    setting = res.scalar_one_or_none()
    if setting and setting.value:
        return setting.value
    if DEFAULT_ENV_PIN:
        return hash_pin(DEFAULT_ENV_PIN)
    return None

async def set_db_pin_hash(db: AsyncSession, pin: str) -> None:
    res = await db.execute(select(Setting).where(Setting.key == "master_pin_hash"))
    setting = res.scalar_one_or_none()
    if not setting:
        setting = Setting(key="master_pin_hash", value=hash_pin(pin))
        db.add(setting)
    else:
        setting.value = hash_pin(pin)
    await db.commit()

async def require_admin(
    authorization: Optional[str] = Header(None),
    x_admin_pin: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    current_hash = await get_db_pin_hash(db)
    
    # If no PIN has ever been set, editing is allowed by default until a PIN is created
    if not current_hash:
        return True

    # 1. Check Bearer Token (token is hash of valid pin)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        if token == current_hash:
            return True

    # 2. Check X-Admin-Pin header directly
    if x_admin_pin:
        if verify_pin_str(x_admin_pin, current_hash):
            return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется PIN-код владельца для редактирования",
        headers={"WWW-Authenticate": "Bearer"},
    )
