import asyncio
import datetime
import uuid
import httpx
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logger import log
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.reminder import MaintenancePlan
from app.services.reminder_service import compute_reminder_status
from app.services.starline_service import StarLineService

MAIN_KEYBOARD = {
    "keyboard": [
        [{"text": "📊 Статус / StarLine"}, {"text": "🔧 Ближайшие ТО"}],
        [{"text": "🔄 Обновить StarLine"}, {"text": "ℹ️ Помощь"}],
    ],
    "resize_keyboard": True,
}

class TelegramService:
    @staticmethod
    async def send_message(chat_id: str, text: str, reply_markup: Optional[dict] = None) -> bool:
        """Sends an HTML formatted message to a Telegram chat."""
        if not settings.TELEGRAM_BOT_TOKEN or not chat_id:
            return False

        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                return res.status_code == 200
        except Exception as e:
            log.warning(f"[TelegramService] Failed to send message to {chat_id}: {e}")
            return False

    @staticmethod
    async def generate_link_code(user: User, session) -> str:
        """Generates a unique 1-click binding link for the user."""
        token = uuid.uuid4().hex[:16]
        user.telegram_auth_token = token
        await session.commit()
        bot_username = settings.TELEGRAM_BOT_USERNAME or "to_scanek_bot"
        return f"https://t.me/{bot_username}?start=bind_{token}"

    @staticmethod
    async def unlink_user(user: User, session) -> bool:
        """Unlinks Telegram account from user."""
        user.telegram_chat_id = None
        user.telegram_username = None
        user.telegram_auth_token = None
        await session.commit()
        return True

    @staticmethod
    async def process_update(update: dict):
        """Processes a single incoming Telegram update (command / message)."""
        message = update.get("message")
        if not message:
            return

        chat = message.get("chat", {})
        chat_id = str(chat.get("id", ""))
        text = (message.get("text") or "").strip()
        from_user = message.get("from", {})
        username = from_user.get("username") or from_user.get("first_name", "Пользователь")

        if not chat_id or not text:
            return

        async with AsyncSessionLocal() as session:
            # 1. Handle Binding: /start bind_XXXX
            if text.startswith("/start bind_"):
                token = text.replace("/start bind_", "").strip()
                res = await session.execute(select(User).where(User.telegram_auth_token == token))
                user = res.scalar_one_or_none()
                if user:
                    user.telegram_chat_id = chat_id
                    user.telegram_username = username
                    user.telegram_auth_token = None
                    user.telegram_notifications_enabled = True
                    await session.commit()

                    greeting = (
                        f"🎉 <b>Telegram успешно привязан!</b>\n\n"
                        f"Здравствуйте, <b>{user.full_name or user.username}</b>!\n"
                        f"Теперь вы будете получать мгновенные уведомления о регламентах ТО, "
                        f"разряде аккумулятора и страховках.\n\n"
                        f"Используйте меню ниже для быстрой проверки состояния вашего автопарка:"
                    )
                    await TelegramService.send_message(chat_id, greeting, MAIN_KEYBOARD)
                    return
                else:
                    await TelegramService.send_message(
                        chat_id,
                        "⚠️ <b>Ссылка устарела или недействительна.</b>\nПожалуйста, перейдите в веб-приложение AutoTracker (Настройки ➡️ Уведомления) и нажмите «Подключить Telegram» заново.",
                    )
                    return

            # Find user by chat_id
            res = await session.execute(select(User).where(User.telegram_chat_id == chat_id))
            user = res.scalar_one_or_none()

            if not user:
                welcome_guest = (
                    f"👋 Привет, <b>{username}</b>!\n\n"
                    f"Это официальный бот бортового журнала <b>AutoTracker</b>.\n\n"
                    f"Чтобы подключить бота к вашему аккаунту и автопарку:\n"
                    f"1. Откройте веб-приложение AutoTracker\n"
                    f"2. Перейдите в <b>Настройки</b> ➡️ <b>🔔 Уведомления</b>\n"
                    f"3. Нажмите кнопку <b>«Подключить Telegram»</b>."
                )
                await TelegramService.send_message(chat_id, welcome_guest)
                return

            # 2. Handle Commands for Authenticated User
            cmd = text.lower()

            if cmd in ("/start", "/help", "ℹ️ помощь"):
                help_msg = (
                    f"🚗 <b>AutoTracker Bot</b> — Бортовой журнал\n"
                    f"Аккаунт: <b>{user.username}</b>\n\n"
                    f"📋 <b>Доступные команды:</b>\n"
                    f"• <b>📊 Статус / StarLine</b> (/status) — свежая сводка по авто (пробег, АКБ, бензин, температуры)\n"
                    f"• <b>🔧 Ближайшие ТО</b> (/to) — список предстоящих и просроченных регламентов\n"
                    f"• <b>🔄 Обновить StarLine</b> (/sync) — запросить свежие данные телематики прямо сейчас\n"
                    f"• <b>❌ /unlink</b> — отвязать Telegram от аккаунта"
                )
                await TelegramService.send_message(chat_id, help_msg, MAIN_KEYBOARD)

            elif cmd in ("/status", "📊 статус / starline"):
                vehicles_res = await session.execute(
                    select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.id.asc())
                )
                vehicles = vehicles_res.scalars().all()
                if not vehicles:
                    await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет добавленных автомобилей.", MAIN_KEYBOARD)
                    return

                msg_parts = [f"📊 <b>Сводка по вашему автопарку ({len(vehicles)} авто):</b>\n"]
                for v in vehicles:
                    tank_cap = v.fuel_tank_capacity or 55.0
                    fuel_pct = v.starline_fuel_percent
                    fuel_liters = round((fuel_pct / 100.0) * tank_cap, 1) if fuel_pct is not None else None
                    fuel_str = f"~{fuel_liters} л ({fuel_pct}%)" if fuel_liters is not None else (f"{fuel_pct}%" if fuel_pct is not None else "—")

                    batt = v.starline_battery
                    if batt is not None:
                        batt_status = "🟢" if batt >= 12.4 else ("🟡" if batt >= 11.9 else "🔴")
                        batt_str = f"{batt_status} {batt} В"
                    else:
                        batt_str = "—"

                    guard_str = "🛡️ В охране" if v.starline_is_armed else "⚠️ Снята с охраны"
                    engine_str = "🟢 ДВС заведен" if v.starline_is_running else "⚪ ДВС заглушен"
                    last_sync_str = v.starline_last_sync.strftime("%d.%m.%Y %H:%M") if v.starline_last_sync else "—"

                    car_text = (
                        f"🚘 <b>{v.make} {v.model}</b> {f'({v.license_plate})' if v.license_plate else ''}\n"
                        f"• 🛣️ Пробег: <b>{int(v.current_odometer or 0):,} км</b> | ⏱️ Моточасы: <b>{v.current_engine_hours or 0} м/ч</b>\n"
                        f"• ⛽ Топливо в баке: <b>{fuel_str}</b>\n"
                        f"• 🔋 Аккумулятор: <b>{batt_str}</b>\n"
                        f"• 🌡️ Температура: ДВС <b>{v.starline_engine_temp or '—'}°C</b> | Салон <b>{v.starline_interior_temp or '—'}°C</b>\n"
                        f"• 🔒 Состояние: <b>{guard_str}</b> | <b>{engine_str}</b>\n"
                        f"• 🕒 Синхронизация: <i>{last_sync_str}</i>\n"
                    )
                    msg_parts.append(car_text)

                await TelegramService.send_message(chat_id, "\n".join(msg_parts), MAIN_KEYBOARD)

            elif cmd in ("/to", "🔧 ближайшие то"):
                vehicles_res = await session.execute(
                    select(Vehicle).where(Vehicle.user_id == user.id).options(selectinload(Vehicle.reminders))
                )
                vehicles = vehicles_res.scalars().all()
                if not vehicles:
                    await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет добавленных автомобилей.", MAIN_KEYBOARD)
                    return

                msg_parts = ["🔧 <b>Регламенты технического обслуживания:</b>\n"]
                has_reminders = False

                for v in vehicles:
                    active_reminders = [r for r in (v.reminders or []) if r.is_active]
                    if not active_reminders:
                        continue

                    has_reminders = True
                    msg_parts.append(f"🚘 <b>{v.make} {v.model}</b> (Текущий: {int(v.current_odometer or 0)} км):")
                    for r in active_reminders:
                        st = compute_reminder_status(r, v.current_odometer or 0.0, v.current_engine_hours or 0.0)
                        icon = "🔴" if st.is_overdue else ("🟡" if st.is_due_soon else "🟢")
                        status_label = "ПРОСРОЧЕНО!" if st.is_overdue else ("СКОРО!" if st.is_due_soon else "В норме")
                        
                        rem_text = f"{icon} <b>{r.title}</b> — {status_label}\n"
                        if st.remaining_distance is not None:
                            rem_text += f"   • До ТО: <b>{int(st.remaining_distance)} км</b> (на {int(r.target_odometer)} км)\n"
                        if st.remaining_days is not None:
                            rem_text += f"   • Срок: <b>{st.remaining_days} дн.</b>\n"
                        msg_parts.append(rem_text)

                if not has_reminders:
                    await TelegramService.send_message(chat_id, "✅ Все регламенты ТО в норме, активных напоминаний нет!", MAIN_KEYBOARD)
                else:
                    await TelegramService.send_message(chat_id, "\n".join(msg_parts), MAIN_KEYBOARD)

            elif cmd in ("/sync", "🔄 обновить starline"):
                vehicles_res = await session.execute(
                    select(Vehicle).where(
                        Vehicle.user_id == user.id,
                        Vehicle.telematics_provider == "starline",
                        Vehicle.starline_token.isnot(None),
                    )
                )
                starline_vehicles = vehicles_res.scalars().all()
                if not starline_vehicles:
                    await TelegramService.send_message(
                        chat_id,
                        "🛰️ У вас нет подключенных автомобилей со StarLine телематикой.",
                        MAIN_KEYBOARD,
                    )
                    return

                await TelegramService.send_message(chat_id, "🔄 Запрашиваю свежие данные со StarLine...", MAIN_KEYBOARD)
                synced_count = 0
                for v in starline_vehicles:
                    try:
                        await StarLineService.sync_vehicle_with_starline(session, v)
                        synced_count += 1
                    except Exception as e:
                        log.warning(f"[TelegramService] Sync failed for #{v.id}: {e}")

                await TelegramService.send_message(
                    chat_id,
                    f"✅ Синхронизация завершена для {synced_count} авто! Отправьте /status для просмотра свежих данных.",
                    MAIN_KEYBOARD,
                )

            elif cmd in ("/unlink", "❌ отвязать"):
                await TelegramService.unlink_user(user, session)
                await TelegramService.send_message(
                    chat_id,
                    "👋 Telegram успешно отвязан от вашего аккаунта AutoTracker. Уведомления отключены.",
                )

            else:
                await TelegramService.send_message(
                    chat_id,
                    "❓ Неизвестная команда. Выберите действие в меню ниже или отправьте /help:",
                    MAIN_KEYBOARD,
                )

async def start_telegram_bot_worker():
    """Background polling worker for incoming Telegram updates."""
    if not settings.TELEGRAM_BOT_TOKEN:
        log.info("[Telegram Bot] Token is not set. Telegram bot worker will not start.")
        return

    log.info(f"[Telegram Bot] Starting background polling worker for @{settings.TELEGRAM_BOT_USERNAME}...")
    offset = 0
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getUpdates"

    while True:
        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                res = await client.get(url, params={"offset": offset, "timeout": 25})
                if res.status_code == 200:
                    data = res.json()
                    if data.get("ok"):
                        for update in data.get("result", []):
                            offset = max(offset, update["update_id"] + 1)
                            asyncio.create_task(TelegramService.process_update(update))
                elif res.status_code == 409:
                    log.warning("[Telegram Bot] Conflict: another instance is polling. Waiting 10s...")
                    await asyncio.sleep(10)
                else:
                    await asyncio.sleep(5)
        except asyncio.CancelledError:
            log.info("[Telegram Bot] Polling worker cancelled, shutting down...")
            break
        except Exception as e:
            log.error(f"[Telegram Bot] Polling error: {e}")
            await asyncio.sleep(5)

async def check_and_send_scheduled_telegram_notifications():
    """Periodic background check for maintenance reminders and low battery alerts."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return

    async with AsyncSessionLocal() as session:
        try:
            users_res = await session.execute(
                select(User).where(
                    User.telegram_chat_id.isnot(None),
                    User.telegram_notifications_enabled == True,
                ).options(selectinload(User.vehicles).selectinload(Vehicle.reminders))
            )
            users = users_res.scalars().all()
            now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

            for user in users:
                chat_id = user.telegram_chat_id
                if not chat_id:
                    continue

                for v in (user.vehicles or []):
                    # 1. Low Battery Alert (< 11.8 V)
                    if user.telegram_notify_battery and v.starline_battery and v.starline_battery < 11.8:
                        last_alert = user.telegram_last_battery_alert
                        should_alert = False
                        if not last_alert or (now - last_alert).total_seconds() > 12 * 3600:
                            should_alert = True

                        if should_alert:
                            alert_msg = (
                                f"🪫 <b>Внимание! Критический разряд АКБ!</b>\n\n"
                                f"Автомобиль: <b>{v.make} {v.model}</b>\n"
                                f"Напряжение аккумулятора: <b>{v.starline_battery} В</b> (Критично: &lt; 11.8 В)\n\n"
                                f"⚠️ Рекомендуется завести двигатель или поставить аккумулятор на зарядку!"
                            )
                            await TelegramService.send_message(chat_id, alert_msg, MAIN_KEYBOARD)
                            user.telegram_last_battery_alert = now
                            await session.commit()
        except Exception as e:
            log.error(f"[Telegram Notifications] Error: {e}")

