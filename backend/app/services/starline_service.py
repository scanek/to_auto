import os
import math
import httpx
import hashlib
import json
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.vehicle import Vehicle

DEFAULT_STARLINE_APP_ID = os.getenv("STARLINE_APP_ID", "52429")
DEFAULT_STARLINE_SECRET = os.getenv("STARLINE_SECRET", "sLH_ZdZNh13xPAS1_taVqeUF_uoGk1wP")

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

def _extract_mileage(flat: Dict[str, Any]) -> Optional[float]:
    """
    Specifically extracts total odometer mileage (rfull / mileage / odometer) from StarLine.
    Strictly ignores trip distance, run status flags, etc.
    """
    priority_keys = [
        "devices[0].common.rfull", "common.rfull", "devices[0].rfull", "rfull",
        "devices[0].obd.mileage", "obd.mileage", "devices[0].car_state.mileage", "car_state.mileage",
        "devices[0].mileage", "mileage", "devices[0].odometer", "odometer",
        "devices[0].state.mileage", "state.mileage", "devices[0].total_mileage", "total_mileage",
        "devices[0].can_mileage", "can_mileage", "devices[0].obd_mileage", "obd_mileage"
    ]
    for k in priority_keys:
        if k in flat and flat[k] is not None:
            try:
                val = float(flat[k])
                if val >= 10.0:  # Real total odometer
                    return val
            except (ValueError, TypeError):
                pass
                
    for k, v in flat.items():
        kl = k.lower()
        if (kl.endswith("rfull") or kl.endswith("odometer") or kl.endswith(".mileage") or kl == "mileage") and "trip" not in kl and "day" not in kl:
            try:
                val = float(v)
                if val >= 10.0:
                    return val
            except (ValueError, TypeError):
                pass
                
    return None

def _extract_temperatures(flat: Dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    """
    Specifically and strictly extracts (engine_temp, interior_temp) from StarLine telemetry.
    Avoids key collisions where generic 'temp' matches 'ctemp' or 'itemp'.
    """
    engine_temp = None
    interior_temp = None
    
    # 1. Engine / Coolant Temperature (ctemp / etemp / coolant_temp)
    engine_keys = [
        "devices[0].car_state.ctemp", "car_state.ctemp", "devices[0].ctemp", "ctemp",
        "devices[0].car_state.etemp", "car_state.etemp", "devices[0].etemp", "etemp",
        "devices[0].obd.coolant_temp", "obd.coolant_temp", "devices[0].obd.engine_temp", "obd.engine_temp",
        "devices[0].obd.ctemp", "obd.ctemp", "devices[0].state.ctemp", "state.ctemp",
        "devices[0].common.ctemp", "common.ctemp"
    ]
    for k in engine_keys:
        if k in flat and flat[k] is not None:
            try:
                v = float(flat[k])
                if -40.0 <= v <= 140.0 and v != 127.0 and v != -128.0:
                    engine_temp = v
                    break
            except (ValueError, TypeError):
                pass
                
    if engine_temp is None:
        for k, v in flat.items():
            kl = k.lower()
            if any(s in kl for s in ("ctemp", "etemp", "coolant", "t_engine", "engine_temp")):
                try:
                    vf = float(v)
                    if -40.0 <= vf <= 140.0 and vf != 127.0 and vf != -128.0:
                        engine_temp = vf
                        break
                except (ValueError, TypeError):
                    pass

    # 2. Interior / Cabin Temperature (itemp / temp_in / central unit temp)
    # Strictly check distinct interior keys first, excluding ctemp/etemp keys
    interior_keys = [
        "devices[0].car_state.itemp", "car_state.itemp", "devices[0].itemp", "itemp",
        "devices[0].car_state.temp", "car_state.temp", "devices[0].temp", "devices[0].state.temp",
        "devices[0].common.itemp", "common.itemp", "devices[0].common.temp", "common.temp"
    ]
    for k in interior_keys:
        if k in flat and flat[k] is not None:
            try:
                v = float(flat[k])
                if -40.0 <= v <= 85.0 and v != 127.0 and v != -128.0:
                    interior_temp = v
                    break
            except (ValueError, TypeError):
                pass

    if interior_temp is None:
        for k, v in flat.items():
            kl = k.lower()
            if "itemp" in kl or "cabin" in kl or "interior" in kl or (kl.endswith(".temp") and "ctemp" not in kl and "etemp" not in kl):
                try:
                    vf = float(v)
                    if -40.0 <= vf <= 85.0 and vf != 127.0 and vf != -128.0:
                        interior_temp = vf
                        break
                except (ValueError, TypeError):
                    pass

    return engine_temp, interior_temp

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

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
            "token": token.strip(),
            "Authorization": f"Bearer {token.strip()}",
            "User-Agent": "AutoTracker/2.6.0",
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            endpoints = [
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/user_info",
                f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/user_info",
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/device/{device_id}/state",
                f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/device/{device_id}/state",
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/device/{device_id}/obd",
                f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/device/{device_id}/obd",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}/obd",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}/params",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}",
                f"{STARLINE_DEV_URL}/json/v2/device/{device_id}/state",
                f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/device/{device_id}/position",
                f"{STARLINE_DEV_URL}/json/v2/user/{user_id}/device/{device_id}/position",
                f"{STARLINE_DEV_URL}/json/v1/device/{device_id}/position",
                f"{STARLINE_DEV_URL}/json/v2/device/{device_id}/position",
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

            # 1. Mileage / Odometer (Strict Total Odometer Extraction)
            mileage = _extract_mileage(all_flat)

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

            # 5 & 6. Engine Temperature and Interior / Cabin Temperature (Strict Separation)
            engine_temp, interior_temp = _extract_temperatures(all_flat)

            # 7. SIM Balance
            balance_keys = ("balance", "sim_balance", "balance_val", "common.balance", "devices[0].balance")
            balance = _find_numeric_in_flat(all_flat, balance_keys, min_val=-500.0, max_val=50000.0)

            # 8. Security Alarm Arm Status
            is_armed = None
            for arm_k in ("devices[0].car_state.arm", "car_state.arm", "state.car_state.arm", "arm"):
                if arm_k in all_flat:
                    is_armed = bool(all_flat[arm_k])
                    break

            # 9. Engine Running Status (ign / run)
            is_running = None
            for run_k in ("devices[0].car_state.run", "car_state.run", "state.car_state.run", "run", "devices[0].car_state.ign", "car_state.ign", "state.ign"):
                if run_k in all_flat:
                    is_running = bool(all_flat[run_k])
                    break

            # 10. Handbrake Status (pbrake / handbrake)
            is_handbrake = None
            for hb_k in ("devices[0].car_state.pbrake", "car_state.pbrake", "state.car_state.pbrake", "pbrake", "handbrake"):
                if hb_k in all_flat:
                    is_handbrake = bool(all_flat[hb_k])
                    break

            # 11. Doors Closed Status (door == False means doors are closed)
            is_doors_closed = None
            for door_k in ("devices[0].car_state.door", "car_state.door", "state.car_state.door", "door"):
                if door_k in all_flat:
                    is_doors_closed = not bool(all_flat[door_k])
                    break

            # 12. GSM Signal Level (0-31)
            gsm_level = _find_numeric_in_flat(all_flat, ("devices[0].gsm_lvl", "gsm_lvl", "common.gsm_lvl", "devices[0].gsm", "gsm"), min_val=0.0, max_val=35.0)
            if gsm_level is not None:
                gsm_level = int(gsm_level)

            # 13. GPS vs LBS Anti-Spoofing Cross-Validation Engine
            # In StarLine API:
            # position.x = Latitude (Широта, e.g. 55.3820 N for Vyksa/Moscow)
            # position.y = Longitude (Долгота, e.g. 42.1725 E for Vyksa, 37.61 E for Moscow)
            
            # Extract pure LBS (cellular base station) coordinates
            lbs_lat_keys = (
                "devices[0].lbs.lat", "lbs.lat", "devices[0].lbs.x", "lbs.x", "devices[0].lbs_lat", "position.lbs_lat", "position.lbs_x"
            )
            lbs_lon_keys = (
                "devices[0].lbs.lon", "devices[0].lbs.lng", "lbs.lon", "lbs.lng", "devices[0].lbs.y", "lbs.y", "devices[0].lbs_lon", "position.lbs_lon", "position.lbs_y"
            )
            lbs_lat = _find_numeric_in_flat(all_flat, lbs_lat_keys, min_val=-90.0, max_val=90.0)
            lbs_lon = _find_numeric_in_flat(all_flat, lbs_lon_keys, min_val=-180.0, max_val=180.0)

            # Check if primary position has lbs flag set
            is_pos_lbs = False
            for lbs_k in ("devices[0].position.lbs", "position.lbs", "lbs", "devices[0].lbs"):
                if lbs_k in all_flat and all_flat[lbs_k]:
                    is_pos_lbs = True
                    break

            # Extract raw GPS coordinates
            gps_raw_lat = _find_numeric_in_flat(all_flat, ("devices[0].position.x", "position.x", "devices[0].geo.lat", "geo.lat", "lat", "latitude", "car_state.x", "state.position.x", "x"), min_val=-90.0, max_val=90.0)
            gps_raw_lon = _find_numeric_in_flat(all_flat, ("devices[0].position.y", "position.y", "devices[0].geo.lon", "geo.lon", "lon", "lng", "longitude", "car_state.y", "state.position.y", "y"), min_val=-180.0, max_val=180.0)

            sat_qty = _find_numeric_in_flat(all_flat, ("devices[0].position.sat_qty", "position.sat_qty", "sat_qty", "devices[0].sat_qty", "gps_lvl"), min_val=0.0, max_val=50.0)

            # Normalization helper to ensure Lat and Lon are never inverted
            def _normalize_coords(lat: Optional[float], lon: Optional[float]):
                if lat is None or lon is None:
                    return lat, lon
                # In European Russia & CIS: Latitude is ~45°..70° N, Longitude is ~25°..55° E
                # If lat is in [35..50] and lon is in [51..70], swap them to correct orientation
                if 30.0 <= lat <= 52.0 and 52.1 <= lon <= 80.0:
                    return lon, lat
                return lat, lon

            gps_raw_lat, gps_raw_lon = _normalize_coords(gps_raw_lat, gps_raw_lon)
            lbs_lat, lbs_lon = _normalize_coords(lbs_lat, lbs_lon)

            if is_pos_lbs:
                if lbs_lat is None:
                    lbs_lat = gps_raw_lat
                if lbs_lon is None:
                    lbs_lon = gps_raw_lon

            final_gps_lat = None
            final_gps_lon = None
            final_gps_type = "gps"
            is_spoofed = False

            # Anti-spoof cross check
            if lbs_lat is not None and lbs_lon is not None and gps_raw_lat is not None and gps_raw_lon is not None and not is_pos_lbs:
                dist_km = _haversine_km(gps_raw_lat, gps_raw_lon, lbs_lat, lbs_lon)
                # If GPS shows location > 8 km away from the actual GSM cellular tower serving the SIM card,
                # it is spoofed / jammed by electronic warfare or false satellite signals!
                if dist_km > 8.0:
                    is_spoofed = True
                    final_gps_lat = lbs_lat
                    final_gps_lon = lbs_lon
                    final_gps_type = "lbs"
                else:
                    is_spoofed = False
                    final_gps_lat = gps_raw_lat
                    final_gps_lon = gps_raw_lon
                    final_gps_type = "gps"
            elif lbs_lat is not None and lbs_lon is not None:
                final_gps_lat = lbs_lat
                final_gps_lon = lbs_lon
                final_gps_type = "lbs"
                is_spoofed = False
            elif gps_raw_lat is not None and gps_raw_lon is not None:
                final_gps_lat = gps_raw_lat
                final_gps_lon = gps_raw_lon
                final_gps_type = "gps" if (sat_qty is None or sat_qty > 0) else "lbs"
                is_spoofed = False

            return {
                "mileage": mileage,
                "engine_hours": engine_hours,
                "battery": battery,
                "fuel_percent": fuel_percent,
                "engine_temp": engine_temp,
                "interior_temp": interior_temp,
                "balance": balance,
                "is_armed": is_armed,
                "is_running": is_running,
                "is_handbrake": is_handbrake,
                "is_doors_closed": is_doors_closed,
                "gsm_level": gsm_level,
                "gps_lat": final_gps_lat,
                "gps_lon": final_gps_lon,
                "gps_type": final_gps_type,
                "is_spoofed": is_spoofed,
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

        if telemetry.get("mileage") is not None and telemetry["mileage"] >= 10.0:
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

        if telemetry.get("interior_temp") is not None:
            vehicle.starline_interior_temp = telemetry["interior_temp"]
            updated_fields.append(f"салон: {int(telemetry['interior_temp'])}°C")

        if telemetry.get("balance") is not None:
            vehicle.starline_balance = telemetry["balance"]

        if telemetry.get("is_armed") is not None:
            vehicle.starline_is_armed = telemetry["is_armed"]

        if telemetry.get("is_running") is not None:
            vehicle.starline_is_running = telemetry["is_running"]

        if telemetry.get("is_handbrake") is not None:
            vehicle.starline_is_handbrake = telemetry["is_handbrake"]

        if telemetry.get("is_doors_closed") is not None:
            vehicle.starline_is_doors_closed = telemetry["is_doors_closed"]

        if telemetry.get("gsm_level") is not None:
            vehicle.starline_gsm_level = telemetry["gsm_level"]

        if telemetry.get("gps_lat") is not None and telemetry.get("gps_lon") is not None:
            vehicle.starline_gps_lat = telemetry["gps_lat"]
            vehicle.starline_gps_lon = telemetry["gps_lon"]
            vehicle.starline_gps_type = telemetry.get("gps_type", "gps")
            vehicle.starline_is_spoofed = telemetry.get("is_spoofed", False)

        vehicle.starline_last_sync = now
        await db.commit()
        await db.refresh(vehicle)

        summary = ", ".join(updated_fields) if updated_fields else "Телеметрия обновлена"

        return {
            "vehicle_id": vehicle.id,
            "odometer": vehicle.current_odometer,
            "engine_hours": vehicle.current_engine_hours,
            "battery": vehicle.starline_battery,
            "fuel_percent": vehicle.starline_fuel_percent,
            "engine_temp": vehicle.starline_engine_temp,
            "interior_temp": vehicle.starline_interior_temp,
            "balance": vehicle.starline_balance,
            "is_armed": vehicle.starline_is_armed,
            "is_running": vehicle.starline_is_running,
            "is_handbrake": vehicle.starline_is_handbrake,
            "is_doors_closed": vehicle.starline_is_doors_closed,
            "gsm_level": vehicle.starline_gsm_level,
            "gps_lat": vehicle.starline_gps_lat,
            "gps_lon": vehicle.starline_gps_lon,
            "last_sync": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_summary": summary,
        }

    @staticmethod
    async def execute_device_command(
        device_id: str,
        token: str,
        command_type: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes an active control command on the StarLine device (e.g. arm, disarm, poke, ign_start, ign_stop, valet_on).
        """
        headers = {
            "token": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        # Common StarLine API command execution endpoints
        urls = [
            f"{STARLINE_DEV_URL}/json/v1/device/{device_id}/execute",
            f"{STARLINE_DEV_URL}/json/v2/device/{device_id}/execute",
            f"{STARLINE_DEV_URL}/json/v1/user/{user_id}/device/{device_id}/execute" if user_id else None,
        ]

        payload = {"type": command_type}
        last_error = "Не удалось отправить команду"

        async with httpx.AsyncClient(timeout=15.0) as client:
            for url in filter(None, urls):
                try:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        code = data.get("code", 200)
                        if code in (200, 0):
                            return {
                                "status": "success",
                                "command": command_type,
                                "message": data.get("codestring") or "Команда успешно принята StarLine",
                                "raw": data,
                            }
                        else:
                            last_error = data.get("codestring") or f"Ошибка StarLine: код {code}"
                    else:
                        last_error = f"HTTP {resp.status_code}: {resp.text}"
                except Exception as ex:
                    last_error = str(ex)

        raise ValueError(last_error)
