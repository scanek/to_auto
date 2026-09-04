from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
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

@router.get('/status', response_model=TelegramStatusResponse)
async def get_telegram_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    link_url = await TelegramService.generate_link_code(current_user, db)
    return TelegramStatusResponse(
        is_connected=bool(current_user.telegram_chat_id),
        telegram_username=current_user.telegram_username,
        telegram_chat_id=current_user.telegram_chat_id,
        bot_username=settings.TELEGRAM_BOT_USERNAME or 'to_scanek_bot',
        link_url=link_url,
        notifications_enabled=bool(current_user.telegram_notifications_enabled),
        notify_reminders=bool(current_user.telegram_notify_reminders),
        notify_battery=bool(current_user.telegram_notify_battery),
        notify_documents=bool(current_user.telegram_notify_documents),
    )

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