from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import get_db_pin_hash, set_db_pin_hash, verify_pin_str, hash_pin

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    pin: str

class SetPinRequest(BaseModel):
    old_pin: Optional[str] = None
    new_pin: str

@router.get("/status")
async def get_auth_status(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    current_hash = await get_db_pin_hash(db)
    has_pin = bool(current_hash)
    
    is_authenticated = False
    if not has_pin:
        # If no PIN is configured, owner mode is unlocked by default
        is_authenticated = True
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        if token == current_hash:
            is_authenticated = True

    return {
        "has_pin": has_pin,
        "is_authenticated": is_authenticated,
    }

@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    current_hash = await get_db_pin_hash(db)
    
    # If no pin is set yet, any pin sets it or logs in
    if not current_hash:
        await set_db_pin_hash(db, payload.pin)
        return {
            "token": hash_pin(payload.pin),
            "message": "PIN-код успешно установлен и вы авторизованы",
        }
    
    if not verify_pin_str(payload.pin, current_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный PIN-код владельца",
        )
    
    return {
        "token": current_hash,
        "message": "Успешная авторизация владельца",
    }

@router.post("/set-pin")
async def change_pin(payload: SetPinRequest, db: AsyncSession = Depends(get_db)):
    current_hash = await get_db_pin_hash(db)
    
    if current_hash:
        if not payload.old_pin or not verify_pin_str(payload.old_pin, current_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Старый PIN-код указан неверно",
            )
            
    if not payload.new_pin or len(payload.new_pin.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN-код должен содержать минимум 3 символа",
        )

    await set_db_pin_hash(db, payload.new_pin.strip())
    new_hash = hash_pin(payload.new_pin.strip())
    
    return {
        "token": new_hash,
        "message": "PIN-код успешно изменен",
    }
