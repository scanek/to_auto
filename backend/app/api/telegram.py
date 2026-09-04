from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from sqlalchemy import select, delete
from app.models.user import User, UserRole
from app.models.setting import Setting
from app.core.security import get_current_user
from app.core.config import settings
from app.services.telegram_service import TelegramService

router = APIRouter(prefix='/telegram', tags=['Telegram'])

class TelegramSettingsUpdate(BaseModel):
    telegram_notifications_enabled: Optional[bool] = None
    telegram_notify_reminders: Optional[bool] = None
    telegram_notify_battery: Optional[bool] = None
    telegram_notify_documents: Optional[bool] = None

class TelegramStatusResponse(BaseModel):
    is_connected: bool
    telegram_username: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    bot_username: str
    link_url: str
    notifications_enabled: bool
    notify_reminders: bool
    notify_battery: bool
    notify_documents: bool

class TelegramBotConfigResponse(BaseModel):
    bot_token: Optional[str] = None
    bot_username: str
    bot_name: Optional[str] = None
    is_custom_token: bool
    is_active: bool
    status_detail: Optional[str] = None

class TelegramBotConfigUpdate(BaseModel):
    bot_token: str

@router.get('/status', response_model=TelegramStatusResponse)
async def get_telegram_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    link_url = await TelegramService.generate_link_code(current_user, db)
    bot_username = await TelegramService.get_bot_username(db)
    return TelegramStatusResponse(
        is_connected=bool(current_user.telegram_chat_id),
        telegram_username=current_user.telegram_username,
        telegram_chat_id=current_user.telegram_chat_id,
        bot_username=bot_username,
        link_url=link_url,
        notifications_enabled=bool(current_user.telegram_notifications_enabled),
        notify_reminders=bool(current_user.telegram_notify_reminders),
        notify_battery=bool(current_user.telegram_notify_battery),
        notify_documents=bool(current_user.telegram_notify_documents),
    )

@router.get('/bot-config', response_model=TelegramBotConfigResponse)
async def get_bot_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: retrieves current bot token configuration and live Telegram status."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ разрешен только администраторам")

    # Check custom token in DB
    s_res = await db.execute(select(Setting).where(Setting.key == "telegram_bot_token"))
    custom_setting = s_res.scalar_one_or_none()
    is_custom = bool(custom_setting and custom_setting.value and custom_setting.value.strip())

    token = await TelegramService.get_bot_token(db)
    bot_username = await TelegramService.get_bot_username(db)

    if not token:
        return TelegramBotConfigResponse(
            bot_token=None,
            bot_username=bot_username,
            bot_name=None,
            is_custom_token=False,
            is_active=False,
            status_detail="Токен бота не настроен",
        )

    # Verify with Telegram API
    check = await TelegramService.verify_bot_token(token)
    if check.get("valid"):
        b_info = check.get("bot", {})
        return TelegramBotConfigResponse(
            bot_token=token,
            bot_username=b_info.get("username", bot_username),
            bot_name=b_info.get("first_name", "AutoTracker Bot"),
            is_custom_token=is_custom,
            is_active=True,
            status_detail="Бот активен и подключен к Telegram API",
        )
    else:
        return TelegramBotConfigResponse(
            bot_token=token,
            bot_username=bot_username,
            bot_name=None,
            is_custom_token=is_custom,
            is_active=False,
            status_detail=check.get("error", "Ошибка проверки токена"),
        )

@router.put('/bot-config')
async def update_bot_config(
    payload: TelegramBotConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: tests and updates the Telegram Bot API Token."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ разрешен только администраторам")

    new_token = (payload.bot_token or "").strip()
    if not new_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Токен бота не может быть пустым")

    # Validate with Telegram API
    check = await TelegramService.verify_bot_token(new_token)
    if not check.get("valid"):
        err = check.get("error", "Неверный токен бота")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Ошибка проверки токена: {err}")

    bot_info = check.get("bot", {})
    bot_username = bot_info.get("username") or "to_scanek_bot"
    bot_name = bot_info.get("first_name") or "AutoTracker Bot"

    # Save token in DB Setting table
    t_res = await db.execute(select(Setting).where(Setting.key == "telegram_bot_token"))
    t_setting = t_res.scalar_one_or_none()
    if not t_setting:
        t_setting = Setting(key="telegram_bot_token", value=new_token)
        db.add(t_setting)
    else:
        t_setting.value = new_token

    # Save username in DB Setting table
    u_res = await db.execute(select(Setting).where(Setting.key == "telegram_bot_username"))
    u_setting = u_res.scalar_one_or_none()
    if not u_setting:
        u_setting = Setting(key="telegram_bot_username", value=bot_username)
        db.add(u_setting)
    else:
        u_setting.value = bot_username

    await db.commit()

    # Update runtime memory cache
    TelegramService.set_cached_bot_credentials(new_token, bot_username)

    return {
        "message": f"Бот @{bot_username} ({bot_name}) успешно сохранен и подключен!",
        "bot_username": bot_username,
        "bot_name": bot_name,
        "is_active": True,
    }

@router.delete('/bot-config')
async def reset_bot_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: resets custom bot token back to default environment settings."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ разрешен только администраторам")

    await db.execute(delete(Setting).where(Setting.key.in_(["telegram_bot_token", "telegram_bot_username"])))
    await db.commit()
    TelegramService.set_cached_bot_credentials(None, None)

    default_username = await TelegramService.get_bot_username(db)
    return {
        "message": "Настройки токена сброшены к значениям по умолчанию",
        "bot_username": default_username,
    }

@router.post('/unlink')
async def unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await TelegramService.unlink_user(current_user, db)
    return {'message': 'Telegram disconnected'}

@router.post('/test-message')
async def send_test_message(
    current_user: User = Depends(get_current_user),
):
    if not current_user.telegram_chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Telegram not connected',
        )
    test_text = (
        '🔔 <b>Тестовое уведомление AutoTracker</b>\n\n'
        '✅ Связь с Telegram-ботом работает отлично!\n'
        'Вы будете получать важные оповещения о регламентах ТО и состоянии автомобиля.'
    )
    ok = await TelegramService.send_message(current_user.telegram_chat_id, test_text)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to send message',
        )
    return {'message': 'Test message sent'}

@router.put('/settings')
async def update_telegram_settings(
    payload: TelegramSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.telegram_notifications_enabled is not None:
        current_user.telegram_notifications_enabled = payload.telegram_notifications_enabled
    if payload.telegram_notify_reminders is not None:
        current_user.telegram_notify_reminders = payload.telegram_notify_reminders
    if payload.telegram_notify_battery is not None:
        current_user.telegram_notify_battery = payload.telegram_notify_battery
    if payload.telegram_notify_documents is not None:
        current_user.telegram_notify_documents = payload.telegram_notify_documents
    await db.commit()
    await db.refresh(current_user)
    return {'message': 'Settings updated'}