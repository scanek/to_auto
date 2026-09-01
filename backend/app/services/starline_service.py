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

def _flatten_dict(d: Any, parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    items = []
    if isinstance(d, dict):
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else str(k)
            if isinstance(v, (dict, list)):
                items.extend(_flatten_dict(v, new_key, sep=sep).items())
            else:
                items.append((new_key, v))
    elif isinstance(d, list):
        for i, item in enumerate(d):
            new_key = f"{parent_key}[{i}]" if parent_key else f"[{i}]"
            if isinstance(item, (dict, list)):
                items.extend(_flatten_dict(item, new_key, sep=sep).items())
            else:
                items.append((new_key, item))
    return dict(items)

def _find_numeric_in_flat(flat: Dict[str, Any], substrings: tuple[str, ...], min_val: float = 0.0, max_val: float = 1e9) -> Optional[float]:
    for k, v in flat.items():
        k_lower = k.lower()
        if any(k_lower == s or k_lower.endswith(f".{s}") or k_lower.endswith(f"_{s}") or f"['{s}']" in k_lower for s in substrings):
            if v is not None:
                try:
                    val = float(v)
                    if min_val <= val <= max_val:
                        return val
                except (ValueError, TypeError):
                    pass

    for k, v in flat.items():
        k_lower = k.lower()
        if any(s in k_lower for s in substrings):
            if v is not None:
                try:
                    val = float(v)
                    if min_val <= val <= max_val:
                        return val
                except (ValueError, TypeError):
                    pass
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
        captcha_sid: Optional[str] = None,
        captcha_code: Optional[str] = None,
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
            if captcha_sid and captcha_code:
                login_data["captchaSid"] = captcha_sid.strip()
                login_data["captchaCode"] = captcha_code.strip()

            login_res = await client.post(f"{STARLINE_ID_URL}/user/login", data=login_data)
            login_json = _safe_json_parse(login_res, "user/login")
            
            if login_json.get("state") != 1:
                desc = login_json.get("desc", {})
                msg = desc.get("message", "Неверный логин или пароль")
                if "captcha" in msg.lower() or desc.get("captchaSid"):
                    return {
                        "status": "captcha_needed",
                        "user_id": "",
                        "token": "",
                        "captcha_sid": desc.get("captchaSid"),
                        "captcha_img": desc.get("captchaImg") or f"https://id.starline.ru/apiV3/captcha/{desc.get('captchaSid')}",
                        "message": "Введите символы с картинки (Captcha)",
                        "devices": [],
                    }
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
            
            if not devices:
                devices.append({
                    "device_id": str(user_id) if user_id else "s96_device",
                    "alias": "StarLine S96 (Основное авто)",
                    "type": "S96",
                    "imei": "",
                    "phone": "",
                    "fw_version": "",
                    "active": True,
                })

            return devices

    @staticmethod
    async def fetch_device_telemetry(user_id: str, device_id: str, token: str) -> Dict[str, Any]:
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

            all_flat: Dict[str, Any] = {}
            for url in endpoints:
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200 and resp.text and resp.text.strip():
                        data = resp.json()
                        flat = _flatten_dict(data)
                        all_flat.update(flat)
                except Exception:
                    pass

            # 1. Mileage / Odometer
            mileage_keys = (
                "mileage", "odometer", "obd_mileage", "rfull", "total_mileage", 
                "car_mileage", "can_mileage", "odo", "run", "distance", "km",
                "obd.mileage", "common.rfull", "state.mileage", "car_state.mileage"
            )
            mileage = _find_numeric_in_flat(all_flat, mileage_keys, min_val=1.0)

            # 2. Engine Hours
            hours_keys = (
                "engine_hours", "hours", "motohours", "moto_hours", "obd_engine_hours",
                "engine_time_hours", "work_hours", "worktime_hours", "ign_hours",
                "obd.engine_hours", "state.engine_hours", "car_state.engine_hours",
                "r_engine", "r_ign", "work_time", "car_state.r_engine", "common.engine_time"
            )
            engine_hours = _find_numeric_in_flat(all_flat, hours_keys, min_val=0.1, max_val=50000.0)

            if engine_hours is None:
                sec_keys = (
                    "engine_time", "engine_time_sec", "engine_work_time", "work_time", 
                    "ign_time", "ignition_time", "r_engine", "r_ign", "r_run", "engine_runs",
                    "engine_on_time", "time_engine", "total_engine_time", "total_work_time",
                    "obd.engine_time", "car_state.r_engine", "state.engine_time", "car_state.ign_time"
                )
                raw_val = _find_numeric_in_flat(all_flat, sec_keys, min_val=60.0)
                if raw_val:
                    if raw_val > 10000.0:
                        engine_hours = round(raw_val / 3600.0, 1)
                    elif raw_val > 600.0 and raw_val <= 10000.0:
                        engine_hours = round(raw_val / 60.0, 1)
                    else:
                        engine_hours = round(raw_val, 1)

            # 3. Battery Voltage
            bat_keys = ("battery", "battery_val", "voltage", "akb", "bat_volt", "v_bat", "common.battery")
            battery = _find_numeric_in_flat(all_flat, bat_keys, min_val=5.0, max_val=24.0)

            # 4. Fuel %
            fuel_keys = ("fuel", "fuel_lvl", "fuel_percent", "gas_level", "fuel_litres", "fuel_val", "obd.fuel")
            fuel_percent = _find_numeric_in_flat(all_flat, fuel_keys, min_val=0.0, max_val=100.0)

            # 5. Engine Temperature
            temp_keys = ("ctemp", "engine_temp", "t_engine", "temp_engine", "temp_eng")
            engine_temp = _find_numeric_in_flat(all_flat, temp_keys, min_val=-40.0, max_val=150.0)

            # Diagnostic list of all discovered non-boolean keys inside devices / state / obd / common
            discovered_keys = []
            for k, v in all_flat.items():
                if not isinstance(v, bool) and not any(x in k.lower() for x in ("_id", "imei", "phone", "date", "ts", "pass", "token")):
                    discovered_keys.append(f"{k}={v}")

            return {
                "mileage": mileage,
                "engine_hours": engine_hours,
                "battery": battery,
                "fuel_percent": fuel_percent,
                "engine_temp": engine_temp,
                "discovered_keys": discovered_keys,
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

        summary = ", ".join(updated_fields) if updated_fields else "Телеметрия обновлена"
        
        if telemetry.get("engine_hours") is None and telemetry.get("discovered_keys"):
            # Show the top numeric keys found in StarLine
            sample_keys = [x for x in telemetry["discovered_keys"] if not x.endswith("=None") and not x.endswith("=0")][:4]
            if sample_keys:
                summary += f" [CAN-ключи: {', '.join(sample_keys)}]"

        return {
            "vehicle_id": vehicle.id,
            "odometer": vehicle.current_odometer,
            "engine_hours": vehicle.current_engine_hours,
            "battery": vehicle.starline_battery,
            "fuel_percent": vehicle.starline_fuel_percent,
            "engine_temp": vehicle.starline_engine_temp,
            "last_sync": now.isoformat(),
            "updated_summary": summary,
        }
