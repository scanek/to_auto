import httpx
import hashlib
import json
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.vehicle import Vehicle

DEFAULT_STARLINE_APP_ID = "52429"
DEFAULT_STARLINE_SECRET = "sLH_ZdZNh13xPAS1_taVqeUF_uoGk1wP"

STARLINE_ID_URL = "https://id.starline.ru/apiV3"
STARLINE_DEV_URL = "https://developer.starline.ru"

def _safe_json_parse(resp: httpx.Response, endpoint_name: str) -> dict:
    text = (resp.text or "").strip()
    if not text:
        raise ValueError(f"Сервер StarLine ({endpoint_name}) вернул пустой ответ (HTTP {resp.status_code})")
    try:
        return resp.json()
    except Exception:
        clean_text = text[:150].replace("\n", " ").replace("\r", "")
        raise ValueError(f"Ошибка ответа StarLine ({endpoint_name}): {clean_text}")

class StarLineService:
    @staticmethod
    async def get_app_token(app_id: str = DEFAULT_STARLINE_APP_ID, secret: str = DEFAULT_STARLINE_SECRET) -> str:
        """
        Performs StarLine ID v3 Application handshake (getCode -> getToken).
        """
        async with httpx.AsyncClient(timeout=15.0) as client:
            sec_md5 = hashlib.md5(secret.strip().encode('utf-8')).hexdigest()
            # Step 1: getCode
            code_url = f"{STARLINE_ID_URL}/application/getCode?appId={app_id.strip()}&secret={sec_md5}"
            code_res = await client.get(code_url)
            code_data = _safe_json_parse(code_res, "getCode")
            
            if code_data.get("state") != 1 or "code" not in code_data.get("desc", {}):
                err = code_data.get("desc", {}).get("message", "Неверный AppID или Secret приложения")
                raise ValueError(f"Ошибка StarLine App Code: {err}")
            
            code = code_data["desc"]["code"]

            # Step 2: getToken
            combined_hash = hashlib.md5((secret.strip() + code).encode('utf-8')).hexdigest()
            token_url = f"{STARLINE_ID_URL}/application/getToken?appId={app_id.strip()}&secret={combined_hash}"
            token_res = await client.get(token_url)
            token_data = _safe_json_parse(token_res, "getToken")
            
            if token_data.get("state") != 1 or "token" not in token_data.get("desc", {}):
                err = token_data.get("desc", {}).get("message", "Не удалось получить токен приложения")
                raise ValueError(f"Ошибка StarLine App Token: {err}")
            
            return token_data["desc"]["token"]

    @staticmethod
    async def authenticate_user(
        login: str,
        password: Optional[str] = None,
        app_code: Optional[str] = None,
        app_id: str = DEFAULT_STARLINE_APP_ID,
        secret: str = DEFAULT_STARLINE_SECRET,
        sms_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Authenticates user with StarLine using official StarLine ID v3 protocol.
        """
        # 1. Direct token provided
        if app_code and not password:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(f"{STARLINE_DEV_URL}/json/v2/user_info", headers={"Cookie": f"slnet={app_code.strip()}"})
                data = _safe_json_parse(res, "user_info")
                user_id = str(data.get("user_id", data.get("id", "")))
                return {
                    "user_id": user_id,
                    "token": app_code.strip(),
                    "user_info": data,
                }

        # 2. Get Application Token
        app_token = await StarLineService.get_app_token(app_id=app_id, secret=secret)

        # 3. User Login via id.starline.ru
        async with httpx.AsyncClient(timeout=15.0) as client:
            pass_sha1 = hashlib.sha1((password or "").strip().encode('utf-8')).hexdigest()
            login_data = {
                "token": app_token,
                "login": login.strip(),
                "pass": pass_sha1,
            }
            if sms_code:
                login_data["code"] = sms_code.strip()

            login_res = await client.post(f"{STARLINE_ID_URL}/user/login", data=login_data)
            login_json = _safe_json_parse(login_res, "user/login")
            
            if login_json.get("state") != 1:
                desc = login_json.get("desc", {})
                msg = desc.get("message", "Неверный логин или пароль")
                if "sms" in msg.lower() or "code" in msg.lower() or desc.get("code") == 2:
                    raise ValueError(f"Требуется SMS-код подтверждения: {msg}")
                if "incorrect" in msg.lower():
                    raise ValueError("Неверный логин или пароль от StarLine. Проверьте правильность ввода.")
                raise ValueError(f"Ошибка входа StarLine: {msg}")
            
            user_slid_token = login_json["desc"].get("user_token")
            user_id = str(login_json["desc"].get("user_id", ""))

            if not user_slid_token:
                raise ValueError("Не получен токен пользователя от StarLine ID")

            # 4. Exchange user_slid_token for SLNET session on developer.starline.ru
            slnet_token = user_slid_token
            try:
                slnet_res = await client.post(
                    f"{STARLINE_DEV_URL}/json/v1/auth.slid",
                    json={"slid_token": user_slid_token},
                    headers={"Content-Type": "application/json"}
                )
                if slnet_res.status_code == 200:
                    slnet_data = _safe_json_parse(slnet_res, "auth.slid")
                    if slnet_data.get("token"):
                        slnet_token = slnet_data.get("token")
                    if slnet_data.get("user_id"):
                        user_id = str(slnet_data.get("user_id"))
                    # If devices returned directly in auth.slid
                    if "devices" in slnet_data:
                        login_json["desc"]["devices"] = slnet_data["devices"]
            except Exception as e:
                pass

            # Extract cookies if any
            for c_name, c_val in client.cookies.items():
                if c_name == "slnet" and c_val:
                    slnet_token = c_val

            return {
                "user_id": user_id,
                "token": slnet_token,
                "user_info": login_json.get("desc", {}),
            }

    @staticmethod
    async def get_user_devices(user_id: str, token: str) -> List[Dict[str, Any]]:
        """
        Retrieves list of all vehicles / devices attached to the user's StarLine account.
        """
        headers = {
            "Cookie": f"slnet={token.strip()}; slid_token={token.strip()}",
            "User-Agent": "AutoTracker/2.5.0",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            endpoints_to_try = []
            if user_id:
                endpoints_to_try.extend([
                    f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/user_info",
                    f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/user_info",
                    f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/devices",
                ])
            endpoints_to_try.extend([
                f"{STARLINE_DEV_URL}/json/v2/user_info",
                f"{STARLINE_DEV_URL}/json/v2/devices",
            ])

            last_err = None
            devices_raw = []

            for url in endpoints_to_try:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and resp.text and resp.text.strip():
                        data = resp.json()
                        # Check if devices in data
                        if "devices" in data:
                            devices_raw = data["devices"]
                            break
                        elif "shared_devices" in data:
                            devices_raw = data["shared_devices"]
                            break
                        elif isinstance(data, list):
                            devices_raw = data
                            break
                except Exception as e:
                    last_err = e

            devices = []
            for d in devices_raw:
                dev_id = str(d.get("device_id", d.get("id", "")))
                if not dev_id:
                    continue
                alias = d.get("alias", d.get("name", d.get("car_name", "StarLine S96")))
                devices.append({
                    "device_id": dev_id,
                    "alias": alias,
                    "type": d.get("type", "S96"),
                    "imei": d.get("imei", ""),
                    "phone": d.get("phone", ""),
                    "fw_version": d.get("fw_version", ""),
                    "active": bool(d.get("active", True)),
                })
            
            # If no devices parsed from API list, but we have user_id, add standard device entry
            if not devices and user_id:
                devices.append({
                    "device_id": user_id,
                    "alias": "StarLine S96 (Мой автомобиль)",
                    "type": "S96",
                    "imei": "",
                    "phone": "",
                    "fw_version": "",
                    "active": True,
                })

            return devices

    @staticmethod
    async def fetch_device_telemetry(user_id: str, device_id: str, token: str) -> Dict[str, Any]:
        """
        Fetches live OBD / CAN telemetry state for a specific StarLine device.
        Extracts: mileage (km), engine_hours (hours), battery (V), fuel (%), engine_temp (°C).
        """
        headers = {
            "Cookie": f"slnet={token.strip()}; slid_token={token.strip()}",
            "User-Agent": "AutoTracker/2.5.0",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            endpoints = [
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/device/{device_id}/state",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}",
                f"{STARLINE_DEV_URL}/json/v2/device/{device_id}/state",
            ]

            state = {}
            for url in endpoints:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and resp.text and resp.text.strip():
                        data = resp.json()
                        state = data.get("state", data)
                        if state:
                            break
                except Exception:
                    pass

            obd = state.get("obd", {})
            common = state.get("common", {})

            # 1. Mileage / Odometer
            mileage = None
            if "mileage" in obd and obd["mileage"] is not None:
                mileage = float(obd["mileage"])
            elif "mileage" in state and state["mileage"] is not None:
                mileage = float(state["mileage"])
            elif "mileage" in common and common["mileage"] is not None:
                mileage = float(common["mileage"])

            # 2. Engine Hours
            engine_hours = None
            if "engine_hours" in obd and obd["engine_hours"] is not None:
                engine_hours = float(obd["engine_hours"])
            elif "engine_hours" in state and state["engine_hours"] is not None:
                engine_hours = float(state["engine_hours"])
            elif "engine_time" in state and state["engine_time"] is not None:
                engine_hours = round(float(state["engine_time"]) / 3600.0, 1)

            # 3. Battery Voltage
            battery = None
            if "battery" in common and common["battery"] is not None:
                battery = float(common["battery"])
            elif "battery" in state and state["battery"] is not None:
                battery = float(state["battery"])

            # 4. Fuel %
            fuel_percent = None
            if "fuel" in obd and obd["fuel"] is not None:
                fuel_percent = float(obd["fuel"])
            elif "fuel" in state and state["fuel"] is not None:
                fuel_percent = float(state["fuel"])

            # 5. Engine Temperature
            engine_temp = None
            if "ctemp" in state and state["ctemp"] is not None:
                engine_temp = float(state["ctemp"])
            elif "engine_temp" in state and state["engine_temp"] is not None:
                engine_temp = float(state["engine_temp"])

            return {
                "mileage": mileage,
                "engine_hours": engine_hours,
                "battery": battery,
                "fuel_percent": fuel_percent,
                "engine_temp": engine_temp,
                "raw_state": state,
            }

    @staticmethod
    async def sync_vehicle_with_starline(db: AsyncSession, vehicle: Vehicle) -> Dict[str, Any]:
        """
        Executes live sync between StarLine S96 and the vehicle record in database.
        """
        if not vehicle.starline_user_id or not vehicle.starline_device_id or not vehicle.starline_token:
            raise ValueError("У автомобиля не настроена телематика StarLine")

        telemetry = await StarLineService.fetch_device_telemetry(
            user_id=vehicle.starline_user_id,
            device_id=vehicle.starline_device_id,
            token=vehicle.starline_token,
        )

        now = datetime.datetime.utcnow()
        updated_fields = []

        if telemetry.get("mileage") is not None and telemetry["mileage"] > 0:
            vehicle.odometer = telemetry["mileage"]
            updated_fields.append(f"пробег: {int(telemetry['mileage']):,} км".replace(",", " "))

        if telemetry.get("engine_hours") is not None and telemetry["engine_hours"] > 0:
            vehicle.current_engine_hours = telemetry["engine_hours"]
            updated_fields.append(f"моточасы: {telemetry['engine_hours']} м/ч")

        if telemetry.get("battery") is not None:
            vehicle.starline_battery = telemetry["battery"]
        if telemetry.get("fuel_percent") is not None:
            vehicle.starline_fuel_percent = telemetry["fuel_percent"]
        if telemetry.get("engine_temp") is not None:
            vehicle.starline_engine_temp = telemetry["engine_temp"]

        vehicle.starline_last_sync = now
        await db.commit()
        await db.refresh(vehicle)

        return {
            "vehicle_id": vehicle.id,
            "odometer": vehicle.odometer,
            "engine_hours": vehicle.current_engine_hours,
            "battery": vehicle.starline_battery,
            "fuel_percent": vehicle.starline_fuel_percent,
            "engine_temp": vehicle.starline_engine_temp,
            "last_sync": now.isoformat(),
            "updated_summary": ", ".join(updated_fields) if updated_fields else "Телеметрия обновлена",
        }
