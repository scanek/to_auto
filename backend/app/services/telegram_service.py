import asyncio
import datetime
import uuid
import re
import httpx
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logger import log
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.reminder import MaintenancePlan
from app.models.service import ServiceRecord, RecordType
from app.models.fuel import FuelLog
from app.models.document import DocumentNote
from app.models.setting import Setting
from app.models.password_reset import PasswordReset
from app.core.datetime_utils import utc_now_naive
from app.services.reminder_service import compute_reminder_status, sync_reminder_baselines
from app.services.starline_service import StarLineService

MAIN_KEYBOARD = {
    "keyboard": [
        [{"text": "📊 Статус / StarLine"}, {"text": "🔧 Ближайшие ТО"}],
        [{"text": "⛽ Заправить авто"}, {"text": "💰 Расходы и TCO"}],
        [{"text": "📍 Где машина?"}, {"text": "🔄 Обновить StarLine"}],
        [{"text": "ℹ️ Помощь"}],
    ],
    "resize_keyboard": True,
}

class TelegramService:
    _cached_bot_token: Optional[str] = None
    _cached_bot_username: Optional[str] = None

    @classmethod
    async def get_bot_token(cls, session=None) -> Optional[str]:
        if cls._cached_bot_token:
            return cls._cached_bot_token
        try:
            if session:
                res = await session.execute(select(Setting).where(Setting.key == "telegram_bot_token"))
                setting = res.scalar_one_or_none()
                if setting and setting.value and setting.value.strip():
                    cls._cached_bot_token = setting.value.strip()
                    return cls._cached_bot_token
            else:
                async with AsyncSessionLocal() as s:
                    res = await s.execute(select(Setting).where(Setting.key == "telegram_bot_token"))
                    setting = res.scalar_one_or_none()
                    if setting and setting.value and setting.value.strip():
                        cls._cached_bot_token = setting.value.strip()
                        return cls._cached_bot_token
        except Exception:
            pass

        return settings.TELEGRAM_BOT_TOKEN

    @classmethod
    async def get_bot_username(cls, session=None) -> str:
        if cls._cached_bot_username:
            return cls._cached_bot_username
        try:
            if session:
                res = await session.execute(select(Setting).where(Setting.key == "telegram_bot_username"))
                setting = res.scalar_one_or_none()
                if setting and setting.value and setting.value.strip():
                    cls._cached_bot_username = setting.value.strip()
                    return cls._cached_bot_username
            else:
                async with AsyncSessionLocal() as s:
                    res = await s.execute(select(Setting).where(Setting.key == "telegram_bot_username"))
                    setting = res.scalar_one_or_none()
                    if setting and setting.value and setting.value.strip():
                        cls._cached_bot_username = setting.value.strip()
                        return cls._cached_bot_username
        except Exception:
            pass

        return settings.TELEGRAM_BOT_USERNAME or "to_scanek_bot"

    @classmethod
    def set_cached_bot_credentials(cls, token: Optional[str], username: Optional[str]):
        cls._cached_bot_token = token.strip() if token else None
        cls._cached_bot_username = username.strip() if username else None

    @staticmethod
    async def verify_bot_token(token: str) -> dict:
        """Validates token with Telegram API getMe."""
        if not token or not token.strip():
            return {"valid": False, "error": "Токен не может быть пустым"}
        url = f"https://api.telegram.org/bot{token.strip()}/getMe"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("ok"):
                        return {"valid": True, "bot": data.get("result", {})}
                    return {"valid": False, "error": data.get("description", "Неизвестная ошибка Telegram")}
                elif res.status_code == 401:
                    return {"valid": False, "error": "Неверный токен (401 Unauthorized). Проверьте токен от @BotFather"}
                else:
                    return {"valid": False, "error": f"Ошибка HTTP {res.status_code}: {res.text}"}
        except Exception as e:
            return {"valid": False, "error": f"Сетевая ошибка при проверке токена: {e}"}

    @staticmethod
    async def send_message(
        chat_id: str,
        text: str,
        reply_markup: Optional[dict] = None,
        disable_preview: bool = True
    ) -> Optional[dict]:
        """Sends an HTML formatted message to a Telegram chat."""
        token = await TelegramService.get_bot_token()
        if not token or not chat_id:
            return None

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": disable_preview,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    return res.json().get("result")
                else:
                    log.warning(f"[TelegramService] sendMessage returned {res.status_code}: {res.text}")
                    return None
        except Exception as e:
            log.warning(f"[TelegramService] Failed to send message to {chat_id}: {e}")
            return None

    @staticmethod
    async def edit_message_text(
        chat_id: str,
        message_id: int,
        text: str,
        reply_markup: Optional[dict] = None,
        disable_preview: bool = True
    ) -> bool:
        """Edits an existing Telegram message."""
        token = await TelegramService.get_bot_token()
        if not token or not chat_id or not message_id:
            return False

        url = f"https://api.telegram.org/bot{token}/editMessageText"
        payload = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": disable_preview,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, json=payload)
                return res.status_code == 200
        except Exception as e:
            log.warning(f"[TelegramService] Failed to edit message {message_id}: {e}")
            return False

    @staticmethod
    async def answer_callback_query(
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False
    ) -> bool:
        """Answers a Telegram inline callback query to dismiss loading state."""
        token = await TelegramService.get_bot_token()
        if not token or not callback_query_id:
            return False

        url = f"https://api.telegram.org/bot{token}/answerCallbackQuery"
        payload = {
            "callback_query_id": callback_query_id,
            "show_alert": show_alert,
        }
        if text:
            payload["text"] = text

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json=payload)
                return res.status_code == 200
        except Exception as e:
            log.warning(f"[TelegramService] Failed to answer callback query: {e}")
            return False

    @staticmethod
    async def send_location(
        chat_id: str,
        latitude: float,
        longitude: float,
        reply_markup: Optional[dict] = None
    ) -> bool:
        """Sends a native Telegram map location pin."""
        token = await TelegramService.get_bot_token()
        if not token or not chat_id:
            return False

        url = f"https://api.telegram.org/bot{token}/sendLocation"
        payload = {
            "chat_id": chat_id,
            "latitude": latitude,
            "longitude": longitude,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, json=payload)
                return res.status_code == 200
        except Exception as e:
            log.warning(f"[TelegramService] Failed to send location: {e}")
            return False

    @staticmethod
    async def generate_link_code(user: User, session) -> str:
        """Generates a unique 1-click binding link for the user."""
        token = uuid.uuid4().hex[:16]
        user.telegram_auth_token = token
        await session.commit()
        bot_username = await TelegramService.get_bot_username(session)
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
    async def check_and_notify_vehicle_reminders(
        session,
        vehicle: Vehicle,
        user: Optional[User] = None,
        force: bool = False
    ) -> bool:
        """
        Evaluates active maintenance reminders for a vehicle and sends an instant Telegram
        notification if any maintenance item is overdue or due soon.
        """
        if not user:
            user_res = await session.execute(select(User).where(User.id == vehicle.user_id))
            user = user_res.scalar_one_or_none()

        if not user or not user.telegram_chat_id or not user.telegram_notifications_enabled or not user.telegram_notify_reminders:
            return False

        await sync_reminder_baselines(session, vehicle.id)
        rem_res = await session.execute(
            select(MaintenancePlan).where(MaintenancePlan.vehicle_id == vehicle.id, MaintenancePlan.is_active == True)
        )
        reminders = rem_res.scalars().all()
        if not reminders:
            return False

        urgent_reminders = []
        for r in reminders:
            st = compute_reminder_status(r, vehicle)
            if st.get("is_overdue") or st.get("is_due_soon"):
                urgent_reminders.append((r, st))

        if not urgent_reminders:
            return False

        has_overdue = any(st.get("is_overdue") for _, st in urgent_reminders)
        icon = "🚨" if has_overdue else "⚠️"
        title_status = "СРОЧНОЕ ОБСЛУЖИВАНИЕ (ТО)" if has_overdue else "ПРИБЛИЖАЕТСЯ СРОК ТО"
        odo_formatted = f"{int(vehicle.current_odometer or 0):,}".replace(",", " ")

        lines = [
            f"{icon} <b>Внимание! {title_status}!</b>\n",
            f"🚘 Автомобиль: <b>{vehicle.make} {vehicle.model}</b>",
            f"🛣️ Текущий пробег: <b>{odo_formatted} км</b>\n",
            "<b>Необходимые работы:</b>",
        ]

        inline_btns = []
        for r, st in urgent_reminders:
            r_icon = "🔴" if st.get("is_overdue") else "🟡"
            r_lbl = "ПРОСРОЧЕНО!" if st.get("is_overdue") else "СКОРО!"
            line = f"{r_icon} <b>{r.title}</b> — {r_lbl}"
            if st.get("remaining_distance") is not None:
                rem_km = int(st["remaining_distance"])
                if rem_km < 0:
                    rem_km_fmt = f"{abs(rem_km):,}".replace(",", " ")
                    line += f"\n   • Просрочено на: <b>{rem_km_fmt} км</b>"
                else:
                    rem_km_fmt = f"{rem_km:,}".replace(",", " ")
                    line += f"\n   • Осталось: <b>{rem_km_fmt} км</b>"
            if st.get("remaining_days") is not None:
                rem_d = st["remaining_days"]
                if rem_d < 0:
                    line += f"\n   • Просрочено на: <b>{abs(rem_d)} дн.</b>"
                else:
                    line += f"\n   • Срок: <b>{rem_d} дн.</b>"
            lines.append(line)

            short_t = (r.title[:20] + "..") if len(r.title) > 22 else r.title
            inline_btns.append([{"text": f"✅ Выполнено: {short_t}", "callback_data": f"done_to:{r.id}"}])

        inline_btns.append([{"text": "🔧 Все регламенты", "callback_data": f"to:{vehicle.id}"}])

        kb = {"inline_keyboard": inline_btns}
        await TelegramService.send_message(user.telegram_chat_id, "\n".join(lines), kb)
        user.telegram_last_reminder_alert = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        await session.commit()
        return True

    @staticmethod
    def build_vehicle_card_text(v: Vehicle) -> str:
        """Formats full telematics and status details for a vehicle."""
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

        plate_str = f" ({v.license_plate})" if v.license_plate else ""
        guard_str = "🛡️ В охране" if v.starline_is_armed else "⚠️ Снята с охраны"
        engine_str = "🟢 ДВС заведен" if v.starline_is_running else "⚪ ДВС заглушен"
        last_sync_str = v.starline_last_sync.strftime("%d.%m.%Y %H:%M") if v.starline_last_sync else "—"
        eng_temp = f"{v.starline_engine_temp}°C" if v.starline_engine_temp is not None else "—"
        cab_temp = f"{v.starline_interior_temp}°C" if v.starline_interior_temp is not None else "—"
        odo_formatted = f"{int(v.current_odometer or 0):,}".replace(",", " ")

        lines = [
            f"🚘 <b>{v.make} {v.model}</b>{plate_str}",
            "━━━━━━━━━━━━━━━━━━━━━",
            f"• 🛣️ Пробег: <b>{odo_formatted} км</b> | ⏱️ Моточасы: <b>{v.current_engine_hours or 0} м/ч</b>",
            f"• ⛽ Топливо в баке: <b>{fuel_str}</b>",
            f"• 🔋 Аккумулятор: <b>{batt_str}</b>",
            f"• 🌡️ ДВС: <b>{eng_temp}</b> | Салон: <b>{cab_temp}</b>",
            f"• 🔒 Статус: <b>{guard_str}</b> | <b>{engine_str}</b>",
            f"• 🕒 Синхронизация: <i>{last_sync_str}</i>",
        ]
        return "\n".join(lines)

    @staticmethod
    def build_vehicle_inline_keyboard(vehicle_id: int, has_telematics: bool = True) -> dict:
        """Builds action buttons for a specific vehicle."""
        buttons = []
        row1 = []
        if has_telematics:
            row1.append({"text": "🔄 StarLine", "callback_data": f"sync:{vehicle_id}"})
            row1.append({"text": "📍 Где авто?", "callback_data": f"map:{vehicle_id}"})
        else:
            row1.append({"text": "🛣️ Пробег", "callback_data": f"prompt_odo:{vehicle_id}"})
        buttons.append(row1)

        row2 = [
            {"text": "⛽ Заправить", "callback_data": f"prompt_fuel:{vehicle_id}"},
            {"text": "🔧 Ближайшие ТО", "callback_data": f"to:{vehicle_id}"},
        ]
        buttons.append(row2)

        row3 = [
            {"text": "💰 Расходы и TCO", "callback_data": f"tco:{vehicle_id}"},
        ]
        buttons.append(row3)

        return {"inline_keyboard": buttons}

    @staticmethod
    async def process_update(update: dict):
        """Processes any incoming update from Telegram."""
        if "callback_query" in update:
            await TelegramService.process_callback_query(update["callback_query"])
        elif "message" in update:
            await TelegramService.process_message(update["message"])

    @staticmethod
    async def process_callback_query(cq: dict):
        cq_id = cq.get("id")
        data = cq.get("data") or ""
        from_user = cq.get("from", {})
        message = cq.get("message", {})
        chat_id = str(message.get("chat", {}).get("id") or from_user.get("id"))
        message_id = message.get("message_id")

        if not chat_id or not data:
            if cq_id:
                await TelegramService.answer_callback_query(cq_id)
            return

        parts = data.split(":", 1)
        action = parts[0]
        arg = parts[1] if len(parts) > 1 else ""

        async with AsyncSessionLocal() as session:
            user_res = await session.execute(select(User).where(User.telegram_chat_id == chat_id))
            user = user_res.scalar_one_or_none()
            if not user:
                await TelegramService.answer_callback_query(
                    cq_id,
                    "⚠️ Аккаунт не привязан. Войдите в AutoTracker и привяжите Telegram.",
                    show_alert=True
                )
                return

            if action == "sync":
                vid = int(arg) if arg.isdigit() else 0
                vres = await session.execute(select(Vehicle).where(Vehicle.id == vid, Vehicle.user_id == user.id))
                v = vres.scalar_one_or_none()
                if not v:
                    await TelegramService.answer_callback_query(cq_id, "Автомобиль не найден.", show_alert=True)
                    return

                await TelegramService.answer_callback_query(cq_id, "🔄 Запрашиваю данные StarLine...")
                try:
                    await StarLineService.sync_vehicle_with_starline(session, v)
                    await session.refresh(v)
                    new_text = TelegramService.build_vehicle_card_text(v)
                    kb = TelegramService.build_vehicle_inline_keyboard(v.id, bool(v.starline_token))
                    if message_id:
                        await TelegramService.edit_message_text(chat_id, message_id, new_text, kb)
                except Exception as e:
                    log.warning(f"[Telegram Callback] Sync error: {e}")
                    await TelegramService.send_message(chat_id, f"⚠️ Ошибка синхронизации StarLine: {e}")

            elif action == "map":
                vid = int(arg) if arg.isdigit() else 0
                vres = await session.execute(select(Vehicle).where(Vehicle.id == vid, Vehicle.user_id == user.id))
                v = vres.scalar_one_or_none()
                if not v:
                    await TelegramService.answer_callback_query(cq_id, "Автомобиль не найден.", show_alert=True)
                    return

                await TelegramService.answer_callback_query(cq_id)
                lat = v.starline_gps_lat
                lon = v.starline_gps_lon

                if lat and lon:
                    await TelegramService.send_location(chat_id, lat, lon)
                    yandex_map_url = f"https://yandex.ru/maps/?pt={lon},{lat}&z=16&l=map"
                    twogis_url = f"https://2gis.ru/geo/{lon},{lat}"
                    guard_str = "🛡️ В охране" if v.starline_is_armed else "⚠️ Снята с охраны"
                    eng_str = "🟢 ДВС заведен" if v.starline_is_running else "⚪ Заглушен"
                    batt_str = f"{v.starline_battery} В" if v.starline_battery is not None else "—"

                    msg = (
                        f"📍 <b>Местоположение {v.make} {v.model}:</b>\n\n"
                        f"• 🌐 Координаты: <code>{lat:.6f}, {lon:.6f}</code>\n"
                        f"• 🔒 Статус: {guard_str} | {eng_str}\n"
                        f"• 🔋 АКБ: <b>{batt_str}</b>\n\n"
                        f"🗺️ <b>Открыть в навигаторе:</b>\n"
                        f"👉 <a href=\"{yandex_map_url}\">Яндекс Карты</a> | <a href=\"{twogis_url}\">2ГИС</a>"
                    )
                    await TelegramService.send_message(chat_id, msg, MAIN_KEYBOARD)
                else:
                    await TelegramService.send_message(
                        chat_id,
                        f"⚠️ Для автомобиля <b>{v.make} {v.model}</b> пока нет сохраненных GPS-координат от StarLine.",
                        MAIN_KEYBOARD
                    )

            elif action == "to":
                vid = int(arg) if arg.isdigit() else 0
                vres = await session.execute(
                    select(Vehicle).where(Vehicle.id == vid, Vehicle.user_id == user.id).options(selectinload(Vehicle.reminders))
                )
                v = vres.scalar_one_or_none()
                if not v:
                    await TelegramService.answer_callback_query(cq_id, "Автомобиль не найден.", show_alert=True)
                    return

                await TelegramService.answer_callback_query(cq_id)
                await sync_reminder_baselines(session, v.id)

                active_reminders = [r for r in (v.reminders or []) if r.is_active]
                if not active_reminders:
                    await TelegramService.send_message(
                        chat_id,
                        f"✅ Для <b>{v.make} {v.model}</b> все регламенты в норме! Активных напоминаний нет.",
                        MAIN_KEYBOARD
                    )
                    return

                odo_formatted = f"{int(v.current_odometer or 0):,}".replace(",", " ")
                msg_lines = [
                    f"🔧 <b>Регламенты ТО для {v.make} {v.model}</b>",
                    f"🛣️ Текущий пробег: <b>{odo_formatted} км</b>\n",
                ]

                inline_buttons = []
                for r in active_reminders:
                    st = compute_reminder_status(r, v)
                    status_val = st.get("status", "ok")
                    icon = "🔴" if status_val == "overdue" else ("🟡" if status_val == "due_soon" else "🟢")
                    status_lbl = "ПРОСРОЧЕНО!" if status_val == "overdue" else ("СКОРО!" if status_val == "due_soon" else "В норме")

                    line = f"{icon} <b>{r.title}</b> — {status_lbl}"
                    rem_dist = st.get("remaining_distance")
                    due_dist = st.get("due_odometer")
                    rem_days = st.get("remaining_days")
                    if rem_dist is not None:
                        target_formatted = f"{int(due_dist):,}".replace(",", " ") if due_dist else "—"
                        rem_dist_formatted = f"{int(rem_dist):,}".replace(",", " ")
                        line += f"\n   • До ТО: <b>{rem_dist_formatted} км</b> (на {target_formatted} км)"
                    if rem_days is not None:
                        line += f"\n   • Срок: <b>{rem_days} дн.</b>"
                    msg_lines.append(line)

                    short_title = (r.title[:20] + "..") if len(r.title) > 22 else r.title
                    inline_buttons.append([{"text": f"✅ Выполнено: {short_title}", "callback_data": f"done_to:{r.id}"}])

                inline_buttons.append([{"text": "🔄 Обновить пробег", "callback_data": f"prompt_odo:{v.id}"}])

                kb = {"inline_keyboard": inline_buttons}
                await TelegramService.send_message(chat_id, "\n".join(msg_lines), kb)

            elif action == "done_to":
                pid = int(arg) if arg.isdigit() else 0
                pres = await session.execute(
                    select(MaintenancePlan).where(MaintenancePlan.id == pid).options(selectinload(MaintenancePlan.vehicle))
                )
                plan = pres.scalar_one_or_none()
                if not plan or not plan.vehicle or plan.vehicle.user_id != user.id:
                    await TelegramService.answer_callback_query(cq_id, "Регламент не найден.", show_alert=True)
                    return

                v = plan.vehicle
                current_odo = v.current_odometer or 0.0
                current_hrs = v.current_engine_hours or 0.0

                plan.last_service_odometer = current_odo
                plan.last_service_hours = current_hrs
                plan.last_service_date = datetime.datetime.utcnow()

                service_rec = ServiceRecord(
                    vehicle_id=v.id,
                    record_type=RecordType.SERVICE.value,
                    to_tag="ТО",
                    date=datetime.datetime.utcnow(),
                    odometer=current_odo,
                    engine_hours=current_hrs,
                    title=f"ТО: {plan.title}",
                    description=f"Отмечено выполненным через Telegram Bot на пробеге {int(current_odo):,} км",
                    cost_labor=0.0,
                    cost_parts=0.0,
                    total_cost=0.0,
                )
                session.add(service_rec)
                await session.commit()

                await TelegramService.answer_callback_query(
                    cq_id,
                    f"🎉 Отлично! Регламент «{plan.title}» выполнен на {int(current_odo)} км!",
                    show_alert=True
                )

                odo_formatted = f"{int(current_odo):,}".replace(",", " ")
                confirm_msg = (
                    f"✅ <b>Регламент успешно обновлен!</b>\n\n"
                    f"🚘 <b>{v.make} {v.model}</b>\n"
                    f"🔧 Выполнено: <b>{plan.title}</b>\n"
                    f"🛣️ Зафиксирован пробег: <b>{odo_formatted} км</b>\n"
                    f"📅 Дата: <b>{datetime.datetime.now().strftime('%d.%m.%Y %H:%M')}</b>\n\n"
                    f"Следующий интервал автоматически пересчитан."
                )
                await TelegramService.send_message(chat_id, confirm_msg, MAIN_KEYBOARD)

            elif action == "tco":
                vid = int(arg) if arg.isdigit() else 0
                await TelegramService.answer_callback_query(cq_id)
                await TelegramService.send_tco_report(chat_id, user, session, specific_vid=vid)

            elif action == "prompt_fuel":
                vid = int(arg) if arg.isdigit() else 0
                vres = await session.execute(select(Vehicle).where(Vehicle.id == vid, Vehicle.user_id == user.id))
                v = vres.scalar_one_or_none()
                car_name = f"{v.make} {v.model}" if v else "авто"
                await TelegramService.answer_callback_query(cq_id)

                help_fuel = (
                    f"⛽ <b>Быстрая запись заправки для {car_name}:</b>\n\n"
                    f"Отправьте сообщение в формате:\n"
                    f"<code>/fuel &lt;литры&gt; &lt;сумма&gt; [пробег]</code>\n\n"
                    f"<b>Примеры:</b>\n"
                    f"• <code>/fuel 45 2700</code> — 45 л на 2 700 ₽\n"
                    f"• <code>/fuel 42.5 2550 28450</code> — 42.5 л, 2550 ₽, пробег 28 450 км\n"
                    f"• <code>/fuel 50 60.50</code> — 50 л по цене 60.50 ₽/л"
                )
                await TelegramService.send_message(chat_id, help_fuel, MAIN_KEYBOARD)

            elif action == "prompt_odo":
                vid = int(arg) if arg.isdigit() else 0
                vres = await session.execute(select(Vehicle).where(Vehicle.id == vid, Vehicle.user_id == user.id))
                v = vres.scalar_one_or_none()
                car_name = f"{v.make} {v.model}" if v else "авто"
                await TelegramService.answer_callback_query(cq_id)

                help_odo = (
                    f"🛣️ <b>Обновление пробега для {car_name}:</b>\n\n"
                    f"Отправьте сообщение в формате:\n"
                    f"<code>/odometer &lt;значение&gt;</code> или <code>/пробег &lt;значение&gt;</code>\n\n"
                    f"<b>Пример:</b>\n"
                    f"• <code>/пробег 28750</code>"
                )
                await TelegramService.send_message(chat_id, help_odo, MAIN_KEYBOARD)

            else:
                await TelegramService.answer_callback_query(cq_id)

    @staticmethod
    async def process_message(message: dict):
        chat = message.get("chat", {})
        chat_id = str(chat.get("id", ""))
        text = (message.get("text") or "").strip()
        from_user = message.get("from", {})
        username = from_user.get("username") or from_user.get("first_name", "Пользователь")

        if not chat_id or not text:
            return

        async with AsyncSessionLocal() as session:
            if text.startswith("/start reset_"):
                reset_token = text.replace("/start reset_", "").strip()
                res = await session.execute(
                    select(PasswordReset)
                    .options(selectinload(PasswordReset.user))
                    .where(PasswordReset.token == reset_token, PasswordReset.is_used == False)
                )
                reset_req = res.scalar_one_or_none()
                if reset_req and reset_req.expires_at > utc_now_naive():
                    user = reset_req.user
                    if not user.telegram_chat_id:
                        user.telegram_chat_id = chat_id
                        user.telegram_username = username
                    await session.commit()
                    reset_msg = (
                        f"🔐 <b>Сброс пароля в AutoTracker</b>\n\n"
                        f"Вы запросили сброс пароля для аккаунта <b>{user.username}</b>.\n\n"
                        f"Ваш проверочный код:\n"
                        f"👉 <code>{reset_req.code}</code> 👈\n\n"
                        f"Введите этот 6-значный код на сайте для установки нового пароля.\n"
                        f"⏱ Код действителен 15 минут."
                    )
                    await TelegramService.send_message(chat_id, reset_msg)
                    return
                else:
                    await TelegramService.send_message(
                        chat_id,
                        "⚠️ <b>Ссылка на сброс пароля устарела или недействительна.</b>\n"
                        "Пожалуйста, запросите код заново на сайте в форме «Забыли пароль?»."
                    )
                    return

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
                        f"Теперь бот подключен к вашему гаражу AutoTracker. Вы будете получать важные оповещения "
                        f"о регламентах ТО, разряде аккумулятора и страховках.\n\n"
                        f"Выберите действие в меню ниже или отправьте команду:"
                    )
                    await TelegramService.send_message(chat_id, greeting, MAIN_KEYBOARD)
                    return
                else:
                    await TelegramService.send_message(
                        chat_id,
                        "⚠️ <b>Ссылка устарела или недействительна.</b>\nПожалуйста, перейдите в веб-приложение AutoTracker (Настройки ➡️ Уведомления) и нажмите «Подключить Telegram» заново.",
                    )
                    return

            res = await session.execute(select(User).where(User.telegram_chat_id == chat_id))
            user = res.scalar_one_or_none()

            if not user:
                welcome_guest = (
                    f"👋 Привет, <b>{username}</b>!\n\n"
                    f"Это официальный бот бортового журнала <b>AutoTracker</b>.\n\n"
                    f"Чтобы подключить бота к вашему гаражу:\n"
                    f"1. Откройте веб-приложение AutoTracker\n"
                    f"2. Перейдите в <b>Настройки</b> ➡️ <b>🔔 Уведомления</b>\n"
                    f"3. Нажмите кнопку <b>«Подключить Telegram»</b>."
                )
                await TelegramService.send_message(chat_id, welcome_guest)
                return

            cmd_raw = text.strip()
            cmd_lower = cmd_raw.lower()

            if cmd_lower in ("/start", "/help", "ℹ️ помощь", "помощь"):
                help_msg = (
                    f"🚗 <b>AutoTracker Bot</b> — Интерактивный бортовой журнал\n"
                    f"Аккаунт: <b>{user.username}</b>\n\n"
                    f"📋 <b>Основные команды:</b>\n"
                    f"• <b>📊 Статус</b> (<code>/status</code>) — сводка по авто, StarLine телематика, интерактивные кнопки\n"
                    f"• <b>🔧 Регламенты ТО</b> (<code>/to</code>) — предстоящие работы с кнопками 1-tap отметки выполнения\n"
                    f"• <b>⛽ Заправить авто</b> (<code>/fuel 45 2700</code>) — быстрая запись заправки с расчетом расхода\n"
                    f"• <b>🛣️ Обновить пробег</b> (<code>/odometer 28500</code>) — мгновенная смена одометра\n"
                    f"• <b>💰 Расходы и TCO</b> (<code>/tco</code>) — полная стоимость владения и статистика\n"
                    f"• <b>📍 Где авто?</b> (<code>/map</code>) — GPS-точка + ссылки на Яндекс Карты и 2ГИС\n"
                    f"• <b>🔄 Обновить StarLine</b> (<code>/sync</code>) — принудительный опрос телематики\n"
                    f"• <b>❌ /unlink</b> — отвязать Telegram"
                )
                await TelegramService.send_message(chat_id, help_msg, MAIN_KEYBOARD)

            elif cmd_lower in ("/status", "📊 статус / starline", "статус"):
                vehicles_res = await session.execute(
                    select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.id.asc())
                )
                vehicles = vehicles_res.scalars().all()
                if not vehicles:
                    await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет добавленных автомобилей.", MAIN_KEYBOARD)
                    return

                for v in vehicles:
                    card_text = TelegramService.build_vehicle_card_text(v)
                    kb = TelegramService.build_vehicle_inline_keyboard(v.id, bool(v.starline_token))
                    await TelegramService.send_message(chat_id, card_text, kb)

            elif cmd_lower in ("/to", "🔧 ближайшие то", "то", "регламенты"):
                vehicles_res = await session.execute(
                    select(Vehicle).where(Vehicle.user_id == user.id).options(selectinload(Vehicle.reminders)).order_by(Vehicle.id.asc())
                )
                vehicles = vehicles_res.scalars().all()
                if not vehicles:
                    await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет добавленных автомобилей.", MAIN_KEYBOARD)
                    return

                for v in vehicles:
                    await sync_reminder_baselines(session, v.id)
                    active_reminders = [r for r in (v.reminders or []) if r.is_active]

                    if not active_reminders:
                        await TelegramService.send_message(
                            chat_id,
                            f"✅ <b>{v.make} {v.model}</b>: все регламенты в норме, активных напоминаний нет!",
                            MAIN_KEYBOARD
                        )
                        continue

                    odo_formatted = f"{int(v.current_odometer or 0):,}".replace(",", " ")
                    msg_lines = [
                        f"🔧 <b>Регламенты ТО для {v.make} {v.model}</b>",
                        f"🛣️ Текущий пробег: <b>{odo_formatted} км</b>\n",
                    ]

                    inline_buttons = []
                    for r in active_reminders:
                        st = compute_reminder_status(r, v)
                        status_val = st.get("status", "ok")
                        icon = "🔴" if status_val == "overdue" else ("🟡" if status_val == "due_soon" else "🟢")
                        status_lbl = "ПРОСРОЧЕНО!" if status_val == "overdue" else ("СКОРО!" if status_val == "due_soon" else "В норме")

                        line = f"{icon} <b>{r.title}</b> — {status_lbl}"
                        rem_dist = st.get("remaining_distance")
                        due_dist = st.get("due_odometer")
                        rem_days = st.get("remaining_days")
                        if rem_dist is not None:
                            target_formatted = f"{int(due_dist):,}".replace(",", " ") if due_dist else "—"
                            rem_dist_formatted = f"{int(rem_dist):,}".replace(",", " ")
                            line += f"\n   • До ТО: <b>{rem_dist_formatted} км</b> (на {target_formatted} км)"
                        if rem_days is not None:
                            line += f"\n   • Срок: <b>{rem_days} дн.</b>"
                    msg_lines.append(line)

                    short_title = (r.title[:20] + "..") if len(r.title) > 22 else r.title
                    inline_buttons.append([{"text": f"✅ Выполнено: {short_title}", "callback_data": f"done_to:{r.id}"}])

                    inline_buttons.append([{"text": "🔄 Обновить пробег", "callback_data": f"prompt_odo:{v.id}"}])

                    kb = {"inline_keyboard": inline_buttons}
                    await TelegramService.send_message(chat_id, "\n".join(msg_lines), kb)

            elif cmd_lower in ("/map", "📍 где машина?", "где", "где авто", "навигатор", "gps"):
                vehicles_res = await session.execute(
                    select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.id.asc())
                )
                vehicles = vehicles_res.scalars().all()
                if not vehicles:
                    await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет добавленных автомобилей.", MAIN_KEYBOARD)
                    return

                for v in vehicles:
                    lat = v.starline_gps_lat
                    lon = v.starline_gps_lon
                    if lat and lon:
                        await TelegramService.send_location(chat_id, lat, lon)
                        yandex_map_url = f"https://yandex.ru/maps/?pt={lon},{lat}&z=16&l=map"
                        twogis_url = f"https://2gis.ru/geo/{lon},{lat}"
                        guard_str = "🛡️ В охране" if v.starline_is_armed else "⚠️ Снята с охраны"
                        eng_str = "🟢 ДВС заведен" if v.starline_is_running else "⚪ Заглушен"
                        batt_str = f"{v.starline_battery} В" if v.starline_battery is not None else "—"

                        msg = (
                            f"📍 <b>Местоположение {v.make} {v.model}:</b>\n\n"
                            f"• 🌐 Координаты: <code>{lat:.6f}, {lon:.6f}</code>\n"
                            f"• 🔒 Статус: {guard_str} | {eng_str}\n"
                            f"• 🔋 АКБ: <b>{batt_str}</b>\n\n"
                            f"🗺️ <b>Открыть в навигаторе:</b>\n"
                            f"👉 <a href=\"{yandex_map_url}\">Яндекс Карты</a> | <a href=\"{twogis_url}\">2ГИС</a>"
                        )
                        await TelegramService.send_message(chat_id, msg, MAIN_KEYBOARD)
                    else:
                        await TelegramService.send_message(
                            chat_id,
                            f"⚠️ Для <b>{v.make} {v.model}</b> пока нет сохраненных GPS координат.",
                            MAIN_KEYBOARD
                        )

            elif cmd_lower in ("/tco", "💰 расходы и tco", "расходы", "статистика"):
                await TelegramService.send_tco_report(chat_id, user, session)

            elif cmd_lower in ("/sync", "🔄 обновить starline", "обновить"):
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
                    f"✅ Синхронизация завершена для {synced_count} авто! Отправьте /status для просмотра обновленных данных.",
                    MAIN_KEYBOARD,
                )

            elif (
                cmd_lower.startswith("/fuel") or
                cmd_lower.startswith("/заправка") or
                cmd_lower.startswith("/бензин") or
                cmd_lower == "⛽ заправить авто"
            ):
                await TelegramService.handle_fuel_command(chat_id, cmd_raw, user, session)

            elif (
                cmd_lower.startswith("/odometer") or
                cmd_lower.startswith("/пробег") or
                cmd_lower.startswith("/км")
            ):
                await TelegramService.handle_odometer_command(chat_id, cmd_raw, user, session)

            elif cmd_lower.startswith("/hours") or cmd_lower.startswith("/моточасы"):
                await TelegramService.handle_engine_hours_command(chat_id, cmd_raw, user, session)

            elif cmd_lower in ("/unlink", "❌ отвязать"):
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

    @staticmethod
    async def handle_fuel_command(chat_id: str, cmd_text: str, user: User, session):
        """Processes quick fuel logs with price and consumption calculation."""
        vres = await session.execute(select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.id.asc()))
        vehicles = vres.scalars().all()
        if not vehicles:
            await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет автомобилей.", MAIN_KEYBOARD)
            return

        tokens = cmd_text.replace(",", ".").split()
        nums = []
        for t in tokens[1:]:
            try:
                nums.append(float(t))
            except ValueError:
                pass

        if not nums:
            v = vehicles[0]
            kb = {
                "inline_keyboard": [
                    [
                        {"text": "⛽ 40 л", "callback_data": f"prompt_fuel:{v.id}"},
                        {"text": "⛽ 50 л", "callback_data": f"prompt_fuel:{v.id}"},
                    ]
                ]
            }
            msg = (
                f"⛽ <b>Быстрое добавление заправки:</b>\n\n"
                f"Отправьте команду в формате:\n"
                f"<code>/fuel &lt;литры&gt; &lt;стоимость/цена&gt; [пробег]</code>\n\n"
                f"<b>Примеры:</b>\n"
                f"• <code>/fuel 45 2700</code> — 45 л на 2 700 ₽\n"
                f"• <code>/fuel 42.5 2550 28450</code> — 42.5 л, 2550 ₽, пробег 28 450 км\n"
                f"• <code>/fuel 50 59.80</code> — 50 л по цене 59.80 ₽/л"
            )
            await TelegramService.send_message(chat_id, msg, kb)
            return

        v = vehicles[0]
        liters = nums[0]
        second_num = nums[1] if len(nums) > 1 else None
        custom_odo = nums[2] if len(nums) > 2 else None

        if second_num is not None:
            if second_num < 150:
                unit_price = second_num
                total_cost = round(liters * unit_price, 2)
            else:
                total_cost = second_num
                unit_price = round(total_cost / liters, 2) if liters > 0 else 0.0
        else:
            unit_price = 60.0
            total_cost = round(liters * unit_price, 2)

        current_odo = custom_odo or v.current_odometer or 0.0
        if custom_odo and custom_odo > (v.current_odometer or 0.0):
            v.current_odometer = custom_odo

        last_fuel_res = await session.execute(
            select(FuelLog).where(FuelLog.vehicle_id == v.id).order_by(FuelLog.date.desc()).limit(1)
        )
        last_fuel = last_fuel_res.scalar_one_or_none()

        dist_traveled = None
        consumption = None
        if last_fuel and last_fuel.odometer and current_odo > last_fuel.odometer:
            dist_traveled = current_odo - last_fuel.odometer
            if dist_traveled > 0 and liters > 0:
                consumption = round((liters / dist_traveled) * 100.0, 2)

        fuel_log = FuelLog(
            vehicle_id=v.id,
            date=datetime.datetime.utcnow(),
            odometer=current_odo,
            fuel_amount=liters,
            total_cost=total_cost,
            unit_price=unit_price,
            is_full_tank=True,
            distance_traveled=dist_traveled,
            consumption=consumption,
            notes="Записано через Telegram Bot",
        )
        session.add(fuel_log)
        await session.commit()

        cost_formatted = f"{int(total_cost):,}".replace(",", " ")
        odo_formatted = f"{int(current_odo):,}".replace(",", " ")
        receipt = (
            f"🧾 <b>Чек заправки сохранен!</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"🚘 Автомобиль: <b>{v.make} {v.model}</b>\n"
            f"⛽ Заправлено: <b>{liters} л</b>\n"
            f"💳 Сумма: <b>{cost_formatted} ₽</b> ({unit_price:.2f} ₽/л)\n"
            f"🛣️ Пробег: <b>{odo_formatted} км</b>\n"
        )
        if consumption:
            dist_formatted = f"{int(dist_traveled):,}".replace(",", " ")
            receipt += f"📈 Расход топлива: <b>{consumption} л/100 км</b> (за {dist_formatted} км)\n"
        receipt += f"📅 Дата: <i>{datetime.datetime.now().strftime('%d.%m.%Y %H:%M')}</i>\n"

        await TelegramService.send_message(chat_id, receipt, MAIN_KEYBOARD)

        # Check if new odometer triggered maintenance reminder
        try:
            await TelegramService.check_and_notify_vehicle_reminders(session, v, user, force=True)
        except Exception as e:
            log.warning(f"[TelegramService] Reminder notification error after fuel: {e}")

    @staticmethod
    async def handle_odometer_command(chat_id: str, cmd_text: str, user: User, session):
        """Processes quick odometer update."""
        vres = await session.execute(select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.id.asc()))
        vehicles = vres.scalars().all()
        if not vehicles:
            await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет автомобилей.", MAIN_KEYBOARD)
            return

        nums = re.findall(r"\d+", cmd_text.replace(" ", "").replace(".", "").replace(",", ""))
        if not nums:
            await TelegramService.send_message(
                chat_id,
                "💡 Укажите пробег, например:\n<code>/odometer 28500</code> или <code>/пробег 28500</code>",
                MAIN_KEYBOARD
            )
            return

        new_odo = float(nums[0])
        v = vehicles[0]
        old_odo = v.current_odometer or 0.0
        v.current_odometer = new_odo
        await session.commit()

        old_formatted = f"{int(old_odo):,}".replace(",", " ")
        new_formatted = f"{int(new_odo):,}".replace(",", " ")
        msg = (
            f"🛣️ <b>Пробег успешно обновлен!</b>\n\n"
            f"🚘 Автомобиль: <b>{v.make} {v.model}</b>\n"
            f"• Предыдущий: {old_formatted} км\n"
            f"• Актуальный: <b>{new_formatted} км</b>"
        )
        kb = {"inline_keyboard": [[{"text": "🔧 Проверить ТО", "callback_data": f"to:{v.id}"}]]}
        await TelegramService.send_message(chat_id, msg, kb)

        # Trigger immediate reminder check
        try:
            await TelegramService.check_and_notify_vehicle_reminders(session, v, user, force=True)
        except Exception as e:
            log.warning(f"[TelegramService] Reminder notification error after odometer: {e}")

    @staticmethod
    async def handle_engine_hours_command(chat_id: str, cmd_text: str, user: User, session):
        """Processes engine hours update."""
        vres = await session.execute(select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.id.asc()))
        vehicles = vres.scalars().all()
        if not vehicles:
            await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет автомобилей.", MAIN_KEYBOARD)
            return

        nums = re.findall(r"\d+", cmd_text)
        if not nums:
            await TelegramService.send_message(chat_id, "💡 Укажите моточасы, например:\n<code>/моточасы 145</code>", MAIN_KEYBOARD)
            return

        new_hours = float(nums[0])
        v = vehicles[0]
        v.current_engine_hours = new_hours
        await session.commit()

        msg = (
            f"⏱️ <b>Моточасы успешно обновлены!</b>\n\n"
            f"🚘 Автомобиль: <b>{v.make} {v.model}</b>\n"
            f"• Актуальные моточасы: <b>{new_hours} м/ч</b>"
        )
        await TelegramService.send_message(chat_id, msg, MAIN_KEYBOARD)

        try:
            await TelegramService.check_and_notify_vehicle_reminders(session, v, user, force=True)
        except Exception as e:
            log.warning(f"[TelegramService] Reminder notification error after hours: {e}")

    @staticmethod
    async def send_tco_report(chat_id: str, user: User, session, specific_vid: Optional[int] = None):
        """Calculates and sends comprehensive TCO and expenses breakdown."""
        query = select(Vehicle).where(Vehicle.user_id == user.id)
        if specific_vid:
            query = query.where(Vehicle.id == specific_vid)
        query = query.order_by(Vehicle.id.asc())

        vres = await session.execute(query)
        vehicles = vres.scalars().all()
        if not vehicles:
            await TelegramService.send_message(chat_id, "🚗 В вашем гараже пока нет добавленных автомобилей.", MAIN_KEYBOARD)
            return

        for v in vehicles:
            s_res = await session.execute(
                select(func.coalesce(func.sum(ServiceRecord.total_cost), 0.0)).where(ServiceRecord.vehicle_id == v.id)
            )
            total_service = float(s_res.scalar() or 0.0)

            f_res = await session.execute(
                select(
                    func.coalesce(func.sum(FuelLog.total_cost), 0.0),
                    func.coalesce(func.sum(FuelLog.fuel_amount), 0.0),
                    func.coalesce(func.avg(FuelLog.consumption), 0.0)
                ).where(FuelLog.vehicle_id == v.id)
            )
            f_row = f_res.first()
            total_fuel = float(f_row[0]) if f_row else 0.0
            total_fuel_amount = float(f_row[1]) if f_row else 0.0
            avg_consumption = round(float(f_row[2]), 1) if f_row and f_row[2] else None

            d_res = await session.execute(
                select(func.coalesce(func.sum(DocumentNote.price), 0.0)).where(DocumentNote.vehicle_id == v.id)
            )
            total_docs = float(d_res.scalar() or 0.0)

            total_all = total_service + total_fuel + total_docs

            start_odo = v.starting_odometer or 0.0
            curr_odo = v.current_odometer or 0.0
            dist_tracked = max(curr_odo - start_odo, 0.0)
            cost_per_km = round(total_all / dist_tracked, 2) if dist_tracked > 100 else None

            pct_fuel = round((total_fuel / total_all) * 100) if total_all > 0 else 0
            pct_srv = round((total_service / total_all) * 100) if total_all > 0 else 0
            pct_doc = round((total_docs / total_all) * 100) if total_all > 0 else 0

            total_formatted = f"{int(total_all):,}".replace(",", " ")
            fuel_formatted = f"{int(total_fuel):,}".replace(",", " ")
            srv_formatted = f"{int(total_service):,}".replace(",", " ")
            doc_formatted = f"{int(total_docs):,}".replace(",", " ")

            tco_card = (
                f"💰 <b>Стоимость владения (TCO) — {v.make} {v.model}</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━\n"
                f"💎 <b>Всего расходов: {total_formatted} ₽</b>\n"
            )
            if cost_per_km:
                dist_formatted = f"{int(dist_tracked):,}".replace(",", " ")
                tco_card += f"📏 Стоимость 1 км: <b>{cost_per_km} ₽/км</b> (пробег в учете: {dist_formatted} км)\n"
            if avg_consumption:
                tco_card += f"📈 Средний расход: <b>{avg_consumption} л/100 км</b>\n"

            tco_card += (
                f"\n📊 <b>Структура расходов:</b>\n"
                f"• ⛽ Топливо: <b>{fuel_formatted} ₽</b> ({pct_fuel}%)\n"
                f"• 🔧 ТО и ремонты: <b>{srv_formatted} ₽</b> ({pct_srv}%)\n"
                f"• 📄 Документы и страховки: <b>{doc_formatted} ₽</b> ({pct_doc}%)\n"
            )

            kb = {
                "inline_keyboard": [
                    [
                        {"text": "⛽ Заправить", "callback_data": f"prompt_fuel:{v.id}"},
                        {"text": "🔧 Ближайшие ТО", "callback_data": f"to:{v.id}"},
                    ],
                    [
                        {"text": "📊 Полный статус", "callback_data": f"sync:{v.id}"},
                    ]
                ]
            }

            await TelegramService.send_message(chat_id, tco_card, kb)


async def start_telegram_bot_worker():
    """Background polling worker for incoming Telegram updates."""
    log.info("[Telegram Bot] Background polling worker initialized.")
    offset = 0
    active_token = None

    while True:
        try:
            token = await TelegramService.get_bot_token()
            if not token:
                await asyncio.sleep(5)
                continue

            if token != active_token:
                active_token = token
                offset = 0
                username = await TelegramService.get_bot_username()
                log.info(f"[Telegram Bot] Starting/Updating polling worker for @{username}...")

            url = f"https://api.telegram.org/bot{active_token}/getUpdates"
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
                elif res.status_code == 401:
                    log.warning("[Telegram Bot] Active token is unauthorized. Waiting 10s...")
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
    """Periodic background check for maintenance reminders, document expirations, and low battery alerts."""
    token = await TelegramService.get_bot_token()
    if not token:
        return

    async with AsyncSessionLocal() as session:
        try:
            users_res = await session.execute(
                select(User).where(
                    User.telegram_chat_id.isnot(None),
                    User.telegram_notifications_enabled == True,
                ).options(
                    selectinload(User.vehicles).selectinload(Vehicle.reminders),
                    selectinload(User.vehicles).selectinload(Vehicle.documents),
                )
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
                            kb = {"inline_keyboard": [[{"text": "🔄 Проверить StarLine", "callback_data": f"sync:{v.id}"}]]}
                            await TelegramService.send_message(chat_id, alert_msg, kb)
                            user.telegram_last_battery_alert = now
                            await session.commit()

                    # 2. Maintenance Reminders Alert (Overdue or Due Soon)
                    if user.telegram_notify_reminders and v.reminders:
                        last_rem_alert = user.telegram_last_reminder_alert
                        should_check_rem = False
                        if not last_rem_alert or (now - last_rem_alert).total_seconds() > 24 * 3600:
                            should_check_rem = True

                        if should_check_rem:
                            await TelegramService.check_and_notify_vehicle_reminders(session, v, user)

                    # 3. Documents / Insurance Expiration (<= 14 days)
                    if user.telegram_notify_documents and v.documents:
                        last_doc_alert = user.telegram_last_document_alert
                        should_check_doc = False
                        if not last_doc_alert or (now - last_doc_alert).total_seconds() > 24 * 3600:
                            should_check_doc = True

                        if should_check_doc:
                            expiring_docs = []
                            for doc in v.documents:
                                if not doc.is_active or not doc.expiration_date:
                                    continue
                                days_left = (doc.expiration_date - now).days
                                if days_left <= 14:
                                    expiring_docs.append((doc, days_left))

                            if expiring_docs:
                                doc_lines = [
                                    f"📄 <b>Внимание! Истекает срок действия документов!</b>\n",
                                    f"🚘 Автомобиль: <b>{v.make} {v.model}</b>\n",
                                ]
                                for doc, days_left in expiring_docs:
                                    d_icon = "🔴" if days_left <= 0 else "🟡"
                                    status_str = f"ИСТЕК ({abs(days_left)} дн. назад)" if days_left <= 0 else f"осталось {days_left} дн."
                                    doc_lines.append(f"{d_icon} <b>{doc.title}</b> ({doc.company or 'Полис'}) — <b>{status_str}</b>")

                                kb = {"inline_keyboard": [[{"text": "📊 Статус авто", "callback_data": f"sync:{v.id}"}]]}
                                await TelegramService.send_message(chat_id, "\n".join(doc_lines), kb)
                                user.telegram_last_document_alert = now
                                await session.commit()

        except Exception as e:
            log.error(f"[Telegram Notifications] Error: {e}")
