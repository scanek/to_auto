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

def _find_numeric_metric(d: Any, target_keys: tuple[str, ...], min_val: float = 0.0) -> Optional[float]:
    """Recursively searches for numeric telemetry metrics in nested StarLine JSON payloads and parameter arrays."""
    if isinstance(d, dict):
        # 1. Direct key match
        for k, v in d.items():
            if k.lower() in target_keys and v is not None:
                try:
                    val = float(v)
                    if val >= min_val:
                        return val
                except (ValueError, TypeError):
                    pass
            # Check parameter objects e.g. {"type": "mileage", "val": 26658} or {"name": "mileage", "value": 26658}
            if k.lower() in ("type", "name", "param", "key", "id") and str(v).lower() in target_keys:
                for val_key in ("val", "value", "v", "data", "num"):
                    if val_key in d and d[val_key] is not None:
                        try:
                            val = float(d[val_key])
                            if val >= min_val:
                                return val
                        except (ValueError, TypeError):
                            pass

        for k, v in d.items():
            found = _find_numeric_metric(v, target_keys, min_val)
            if found is not None:
                return found

    elif isinstance(d, list):
        for item in d:
            found = _find_numeric_metric(item, target_keys, min_val)
            if found is not None:
                return found

    return None

class StarLineService:
    @staticmethod
    async def get_app_token(app_id: str = DEFAULT_STARLINE_APP_ID, secret: str = DEFAULT_STARLINE_SECRET) -> str:
        async with httpx.AsyncClient(timeout=15.0) as client:
            sec_md5 = hashlib.md5(secret.strip().encode('utf-8')).hexdigest()
            code_url = f"{STARLINE_ID_URL}/application/getCode?appId={app_id.strip()}&secret={sec_md5}"
            code_res = await client.get(code_url)
            code_data = _safe_json_parse(code_res, "getCode")
            
            if code_data.get("state") != 1 or "code" not in code_data.get("desc", {}):
                err = code_data.get("desc", {}).get("message", "Неверный AppID или Secret приложения")
                raise ValueError(f"Ошибка StarLine App Code: {err}")
            
            code = code_data["desc"]["code"]

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

        app_token = await StarLineService.get_app_token(app_id=app_id, secret=secret)

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
                    if "devices" in slnet_data:
                        login_json["desc"]["devices"] = slnet_data["devices"]
            except Exception:
                pass

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

            devices_raw = []
            for url in endpoints_to_try:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and resp.text and resp.text.strip():
                        data = resp.json()
                        if "devices" in data:
                            devices_raw = data["devices"]
                            break
                        elif "shared_devices" in data:
                            devices_raw = data["shared_devices"]
                            break
                        elif isinstance(data, list):
                            devices_raw = data
                            break
                except Exception:
                    pass

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
        Fetches live OBD / CAN telemetry state using deep recursive dictionary search across ALL StarLine endpoints.
        """
        headers = {
            "Cookie": f"slnet={token.strip()}; slid_token={token.strip()}",
            "User-Agent": "AutoTracker/2.5.0",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            endpoints = [
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/device/{device_id}/state",
                f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/device/{device_id}/obd",
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/device/{device_id}/obd",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}/obd",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}/params",
                f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/user_info",
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/user_info",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}",
                f"{STARLINE_DEV_URL}/json/v2/device/{device_id}/state",
            ]

            combined_payloads = []
            for url in endpoints:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and resp.text and resp.text.strip():
                        data = resp.json()
                        if isinstance(data, (dict, list)):
                            combined_payloads.append(data)
                except Exception:
                    pass

            # 1. Mileage / Odometer deep search
            mileage_keys = (
                "mileage", "odometer", "obd_mileage", "rfull", "total_mileage", 
                "car_mileage", "can_mileage", "odo", "run", "distance", "km"
            )
            mileage = None
            for p in combined_payloads:
                mileage = _find_numeric_metric(p, mileage_keys, min_val=1.0)
                if mileage is not None:
                    break

            # 2. Engine Hours deep search
            hours_keys = (
                "engine_hours", "hours", "motohours", "moto_hours", "obd_engine_hours",
                "r_engine", "engine_work_time", "work_time_hours"
            )
            engine_hours = None
            for p in combined_payloads:
                engine_hours = _find_numeric_metric(p, hours_keys, min_val=0.1)
                if engine_hours is None:
                    raw_sec = _find_numeric_metric(p, ("engine_time", "engine_time_sec", "work_time", "ign_time"), min_val=60.0)
                    if raw_sec:
                        engine_hours = round(raw_sec / 3600.0, 1)
                if engine_hours is not None:
                    break

            # 3. Battery Voltage
            bat_keys = ("battery", "battery_val", "voltage", "akb", "bat_volt", "v_bat")
            battery = None
            for p in combined_payloads:
                battery = _find_numeric_metric(p, bat_keys, min_val=5.0)
                if battery is not None:
                    break

            # 4. Fuel %
            fuel_keys = ("fuel", "fuel_lvl", "fuel_percent", "gas_level", "fuel_litres", "fuel_val")
            fuel_percent = None
            for p in combined_payloads:
                fuel_percent = _find_numeric_metric(p, fuel_keys, min_val=0.0)
                if fuel_percent is not None:
                    break

            # 5. Engine Temperature
            temp_keys = ("ctemp", "engine_temp", "t_engine", "temp_engine", "temp_eng")
            engine_temp = None
            for p in combined_payloads:
                engine_temp = _find_numeric_metric(p, temp_keys, min_val=-40.0)
                if engine_temp is not None:
                    break

            return {
                "mileage": mileage,
                "engine_hours": engine_hours,
                "battery": battery,
                "fuel_percent": fuel_percent,
                "engine_temp": engine_temp,
                "payloads_count": len(combined_payloads),
            }

    @staticmethod
    async def sync_vehicle_with_starline(db: AsyncSession, vehicle: Vehicle) -> Dict[str, Any]:
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
            vehicle.current_odometer = telemetry["mileage"]
            updated_fields.append(f"пробег: {int(telemetry['mileage']):,} км".replace(",", " "))

        if telemetry.get("engine_hours") is not None and telemetry["engine_hours"] > 0:
            vehicle.current_engine_hours = telemetry["engine_hours"]
            updated_fields.append(f"моточасы: {telemetry['engine_hours']} м/ч")

        if telemetry.get("battery") is not None:
            vehicle.starline_battery = telemetry["battery"]
            updated_fields.append(f"АКБ: {telemetry['battery']:.1f}В")

        if telemetry.get("fuel_percent") is not None:
            vehicle.starline_fuel_percent = telemetry["fuel_percent"]
            updated_fields.append(f"бак: {int(telemetry['fuel_percent'])}%")

        if telemetry.get("engine_temp") is not None:
            vehicle.starline_engine_temp = telemetry["engine_temp"]
            updated_fields.append(f"ДВС: {int(telemetry['engine_temp'])}°C")

        vehicle.starline_last_sync = now
        await db.commit()
        await db.refresh(vehicle)

        return {
            "vehicle_id": vehicle.id,
            "odometer": vehicle.current_odometer,
            "engine_hours": vehicle.current_engine_hours,
            "battery": vehicle.starline_battery,
            "fuel_percent": vehicle.starline_fuel_percent,
            "engine_temp": vehicle.starline_engine_temp,
            "last_sync": now.isoformat(),
            "updated_summary": ", ".join(updated_fields) if updated_fields else "Телеметрия обновлена",
        }
