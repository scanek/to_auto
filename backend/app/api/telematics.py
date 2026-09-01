import secrets
import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.user import User
from app.core.security import get_current_user
from app.services.auth_helper import verify_vehicle_access
from app.services.starline_service import StarLineService

router = APIRouter(prefix="/telematics", tags=["Telematics"])

class StarLineAuthRequest(BaseModel):
    login: str
    password: Optional[str] = None
    app_code: Optional[str] = None
    app_id: Optional[str] = None
    secret: Optional[str] = None
    sms_code: Optional[str] = None

class StarLineConnectRequest(BaseModel):
    login: str
    token: str
    user_id: str
    device_id: str
    device_alias: Optional[str] = None
    auto_sync: bool = False

class WebhookTelemetryPayload(BaseModel):
    odometer: Optional[float] = None
    engine_hours: Optional[float] = None
    battery: Optional[float] = None
    fuel_percent: Optional[float] = None
    engine_temp: Optional[float] = None

@router.post("/{vehicle_id}/starline/auth")
async def authenticate_starline(
    vehicle_id: int,
    payload: StarLineAuthRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticates with StarLine Telematics API and discovers all connected vehicles.
    """
    await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    
    try:
        auth_res = await StarLineService.authenticate_user(
            login=payload.login,
            password=payload.password,
            app_code=payload.app_code,
            app_id=payload.app_id or "52429",
            secret=payload.secret or "sLH_ZdZNh13xPAS1_taVqeUF_uoGk1wP",
            sms_code=payload.sms_code,
        )
        user_id = auth_res["user_id"]
        token = auth_res["token"]

        devices = await StarLineService.get_user_devices(user_id=user_id, token=token)

        return {
            "status": "ok",
            "user_id": user_id,
            "token": token,
            "devices": devices,
            "message": f"Успешно подключено к StarLine. Найдено устройств: {len(devices)}",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка подключения к StarLine: {str(e)}"
        )

@router.post("/{vehicle_id}/starline/connect")
async def connect_starline_device(
    vehicle_id: int,
    payload: StarLineConnectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Connects a specific StarLine device to the vehicle.
    """
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

    vehicle.telematics_provider = "starline"
    vehicle.starline_user_id = payload.user_id
    vehicle.starline_device_id = payload.device_id
    vehicle.starline_device_alias = payload.device_alias or "StarLine S96"
    vehicle.starline_token = payload.token
    vehicle.telematics_auto_sync = payload.auto_sync
    if not vehicle.telematics_webhook_key:
        vehicle.telematics_webhook_key = secrets.token_urlsafe(24)

    await db.commit()
    await db.refresh(vehicle)

    # Perform initial sync
    try:
        sync_result = await StarLineService.sync_vehicle_with_starline(db, vehicle)
        return {
            "status": "connected",
            "message": f"StarLine S96 успешно подключен к {vehicle.make} {vehicle.model}!",
            "sync": sync_result,
        }
    except Exception as e:
        return {
            "status": "connected",
            "message": f"Устройство привязано, но первый опрос завершился с замечанием: {str(e)}",
        }

@router.post("/{vehicle_id}/sync")
async def sync_vehicle_telematics(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    1-Click live sync from StarLine S96 to update odometer, engine hours, battery & fuel.
    """
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

    if vehicle.telematics_provider != "starline":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для этого автомобиля не настроена интеграция со StarLine"
        )

    try:
        res = await StarLineService.sync_vehicle_with_starline(db, vehicle)
        return {
            "status": "success",
            "data": res,
            "message": f"Данные успешно синхронизированы со StarLine S96 ({res.get('updated_summary')})"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось получить свежие данные со StarLine: {str(e)}"
        )

@router.delete("/{vehicle_id}/disconnect")
async def disconnect_telematics(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnects telematics provider from vehicle.
    """
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)

    vehicle.telematics_provider = "none"
    vehicle.starline_user_id = None
    vehicle.starline_device_id = None
    vehicle.starline_device_alias = None
    vehicle.starline_token = None
    vehicle.telematics_auto_sync = False

    await db.commit()
    return {"status": "disconnected", "message": "Телематика отключена"}

@router.post("/webhook/{webhook_key}")
async def telemetry_webhook(
    webhook_key: str,
    payload: WebhookTelemetryPayload,
    db: AsyncSession = Depends(get_db),
):
    """
    Inbound generic webhook for Home Assistant / Tasker / custom CAN trackers.
    """
    vehicle = await db.scalar(select(Vehicle).where(Vehicle.telematics_webhook_key == webhook_key))
    if not vehicle:
        raise HTTPException(status_code=404, detail="Webhook ключ не найден")

    updated = []
    if payload.odometer is not None and payload.odometer > 0:
        vehicle.current_odometer = payload.odometer
        updated.append(f"пробег: {payload.odometer} км")
    if payload.engine_hours is not None and payload.engine_hours > 0:
        vehicle.current_engine_hours = payload.engine_hours
        updated.append(f"моточасы: {payload.engine_hours} м/ч")
    if payload.battery is not None:
        vehicle.starline_battery = payload.battery
    if payload.fuel_percent is not None:
        vehicle.starline_fuel_percent = payload.fuel_percent
    if payload.engine_temp is not None:
        vehicle.starline_engine_temp = payload.engine_temp

    vehicle.starline_last_sync = datetime.datetime.utcnow()
    await db.commit()

    return {
        "status": "success",
        "vehicle_id": vehicle.id,
        "updated": updated,
    }
