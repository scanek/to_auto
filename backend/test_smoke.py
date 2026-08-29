import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import init_db

async def run_tests():
    # Initialize DB schema
    await init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Health check
        res = await ac.get("/health")
        print("Health Check:", res.status_code, res.json())
        assert res.status_code == 200

        # 2. Create Vehicle
        veh_payload = {
            "name": "Семейный кроссовер",
            "make": "Toyota",
            "model": "RAV4",
            "year": 2021,
            "license_plate": "A777AA 777",
            "vin": "JTMDREV1234567890",
            "starting_odometer": 45000,
            "current_odometer": 48200,
            "distance_unit": "km",
            "fuel_unit": "L",
            "currency": "RUB",
            "notes": "2.0L 4WD Вариатор"
        }
        res = await ac.post("/api/v1/vehicles", json=veh_payload)
        print("Create Vehicle:", res.status_code)
        assert res.status_code == 201
        vehicle = res.json()
        veh_id = vehicle["id"]

        # 3. Add Service Record
        service_payload = {
            "record_type": "service",
            "date": "2024-03-15T10:00:00Z",
            "odometer": 50000,
            "title": "ТО-5 (50 000 км) - Замена масла и фильтров",
            "description": "Плановое обслуживание",
            "cost_labor": 3500,
            "cost_parts": 6200,
            "total_cost": 9700,
            "items": [
                {
                    "name": "Масло моторное Toyota 5W-30 (4.2 л)",
                    "part_number": "08880-80845",
                    "category": "part",
                    "quantity": 1,
                    "unit_price": 4500,
                    "total_price": 4500
                },
                {
                    "name": "Фильтр масляный",
                    "part_number": "90915-10004",
                    "category": "part",
                    "quantity": 1,
                    "unit_price": 800,
                    "total_price": 800
                },
                {
                    "name": "Фильтр салонный угольный",
                    "part_number": "87139-50100",
                    "category": "part",
                    "quantity": 1,
                    "unit_price": 900,
                    "total_price": 900
                }
            ]
        }
        res = await ac.post(f"/api/v1/service-records?vehicle_id={veh_id}", json=service_payload)
        print("Create Service Record:", res.status_code)
        assert res.status_code == 201
        srv_record = res.json()
        assert srv_record["total_cost"] == 9700
        assert len(srv_record["items"]) == 3

        # 4. Add Fuel Logs
        fuel_1 = {
            "date": "2024-03-10T12:00:00Z",
            "odometer": 49500,
            "fuel_amount": 50,
            "total_cost": 3000,
            "unit_price": 60,
            "is_full_tank": True,
            "gas_station": "Лукойл",
            "fuel_grade": "АИ-95"
        }
        res = await ac.post(f"/api/v1/fuel-logs?vehicle_id={veh_id}", json=fuel_1)
        assert res.status_code == 201

        fuel_2 = {
            "date": "2024-03-25T14:00:00Z",
            "odometer": 50100, # 600 km driven
            "fuel_amount": 48,
            "total_cost": 2880,
            "unit_price": 60,
            "is_full_tank": True,
            "gas_station": "Газпромнефть",
            "fuel_grade": "АИ-95"
        }
        res = await ac.post(f"/api/v1/fuel-logs?vehicle_id={veh_id}", json=fuel_2)
        assert res.status_code == 201
        fuel_log_2 = res.json()
        print("Fuel log consumption:", fuel_log_2["consumption"], "L/100km")
        assert fuel_log_2["consumption"] == 8.0 # 48L / 600km * 100 = 8.0 L/100km

        # 5. Add Maintenance Reminder
        reminder_payload = {
            "title": "Замена моторного масла",
            "interval_distance": 8000,
            "interval_months": 12,
            "last_service_odometer": 50000,
            "last_service_date": "2024-03-15T10:00:00Z",
            "is_active": True,
            "notify_before_distance": 500,
            "notify_before_days": 14
        }
        res = await ac.post(f"/api/v1/reminders?vehicle_id={veh_id}", json=reminder_payload)
        assert res.status_code == 201
        rem = res.json()
        print("Reminder remaining distance:", rem["remaining_distance"], "Status:", rem["status"])
        assert rem["due_odometer"] == 58000

        # 6. Add Document
        doc_payload = {
            "title": "Полис ОСАГО",
            "doc_type": "insurance",
            "document_number": "XXX 0987654321",
            "expiration_date": "2026-12-31T00:00:00Z",
            "notes": "Без ограничений"
        }
        res = await ac.post(f"/api/v1/documents?vehicle_id={veh_id}", json=doc_payload)
        assert res.status_code == 201

        # 7. Get Analytics
        res = await ac.get(f"/api/v1/analytics/{veh_id}")
        assert res.status_code == 200
        an = res.json()
        print("Analytics Total Spend:", an["total_spend"], "RUB")
        print("Categories:", an["categories"])
        assert an["total_spend"] > 0
        assert an["avg_fuel_consumption"] == 8.0

        # 8. Get Service Booklet HTML
        res = await ac.get(f"/api/v1/export/service-booklet/{veh_id}")
        assert res.status_code == 200
        assert "Сервисная книжка" in res.text
        print("Service booklet HTML exported successfully! Length:", len(res.text))

    print("\n>>> ALL SMOKE TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(run_tests())
