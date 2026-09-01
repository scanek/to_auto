import httpx
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.vehicle import Vehicle

STARLINE_BASE_URL = "https://developer.starline.ru"

class StarLineService:
    @staticmethod
    async def authenticate_user(login: str, password: Optional[str] = None, app_code: Optional[str] = None) -> Dict[str, Any]:
        """
        Authenticates with StarLine Telematics API.
        Accepts login/password from StarLine Online or developer App Code / Token.
        """
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. If user provided a direct SLNET session token, verify it
            if app_code and not password:
                test_headers = {"Cookie": f"slnet={app_code.strip()}"}
                res = await client.get(f"{STARLINE_BASE_URL}/json/v1/user_info", headers=test_headers)
                if res.status_code == 200:
                    data = res.json()
                    user_id = str(data.get("user_id", ""))
                    return {
                        "user_id": user_id,
                        "token": app_code.strip(),
                        "user_info": data,
                    }

            # 2. Standard SLID login / password authentication
            payload = {
                "login": login.strip(),
                "pass": password.strip() if password else "",
            }
            if app_code:
                payload["code"] = app_code.strip()

            resp = await client.post(f"{STARLINE_BASE_URL}/json/v1/auth.slid", json=payload)
            if resp.status_code != 200:
                raise ValueError(f"StarLine API вернул ошибку авторизации (HTTP {resp.status_code})")

            data = resp.json()
            cod = data.get("cod")
            if cod != 200 and cod != "200":
                raise ValueError(f"Ошибка авторизации StarLine: {data.get('desc', data.get('error', 'Неверный логин или пароль'))}")

            token = data.get("token")
            user_id = str(data.get("user_id", ""))

            return {
                "user_id": user_id,
                "token": token,
                "user_info": data,
            }

    @staticmethod
    async def get_user_devices(user_id: str, token: str) -> List[Dict[str, Any]]:
        """
        Retrieves list of all vehicles / devices attached to the user's StarLine account.
        """
        headers = {"Cookie": f"slnet={token.strip()}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{STARLINE_BASE_URL}/json/v1/user/{user_id}/user_info", headers=headers)
            if resp.status_code != 200:
                resp = await client.get(f"{STARLINE_BASE_URL}/json/v1/user_info", headers=headers)

            if resp.status_code != 200:
                raise ValueError(f"Не удалось получить список устройств StarLine (HTTP {resp.status_code})")

            data = resp.json()
            devices_raw = data.get("devices", [])
            devices = []
            for d in devices_raw:
                devices.append({
                    "device_id": str(d.get("device_id", d.get("id", ""))),
                    "alias": d.get("alias", d.get("name", "StarLine Оборудование")),
                    "type": d.get("type", "S96"),
                    "imei": d.get("imei", ""),
                    "phone": d.get("phone", ""),
                    "fw_version": d.get("fw_version", ""),
                    "active": bool(d.get("active", True)),
                })
            return devices

    @staticmethod
    async def fetch_device_telemetry(user_id: str, device_id: str, token: str) -> Dict[str, Any]:
        """
        Fetches live OBD / CAN telemetry state for a specific StarLine device.
        Extracts: mileage (km), engine_hours (hours), battery (V), fuel (%), engine_temp (°C).
        """
        headers = {"Cookie": f"slnet={token.strip()}"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            url = f"{STARLINE_BASE_URL}/json/v2/user/{user_id}/device/{device_id}/state"
            resp = await client.get(url, headers=headers)
            
            if resp.status_code != 200:
                url = f"{STARLINE_BASE_URL}/json/v1/device/{device_id}"
                resp = await client.get(url, headers=headers)

            if resp.status_code != 200:
                raise ValueError(f"Не удалось получить телеметрию с устройства StarLine (HTTP {resp.status_code})")

            data = resp.json()
            state = data.get("state", data)
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
