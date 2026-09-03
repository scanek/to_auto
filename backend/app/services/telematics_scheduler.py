import asyncio
import datetime
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.vehicle import Vehicle
from app.services.starline_service import StarLineService

async def check_and_sync_all_vehicles():
    """
    Checks all vehicles with active StarLine telematics and syncs them if their
    configured auto-sync interval has elapsed.
    """
    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(
                select(Vehicle).where(
                    Vehicle.telematics_provider == "starline",
                    Vehicle.starline_token.isnot(None),
                    Vehicle.starline_device_id.isnot(None),
                    Vehicle.starline_user_id.isnot(None),
                )
            )
            vehicles = res.scalars().all()
            now = datetime.datetime.utcnow()

            for v in vehicles:
                interval_minutes = v.starline_auto_sync_interval_minutes
                # If interval is not explicitly set, fallback to 60 if telematics_auto_sync is enabled, else 0
                if interval_minutes is None:
                    interval_minutes = 60 if v.telematics_auto_sync else 0

                if interval_minutes <= 0:
                    continue  # Auto-sync disabled for this vehicle

                last_sync = v.starline_last_sync
                should_sync = False
                if last_sync is None:
                    should_sync = True
                else:
                    elapsed_minutes = (now - last_sync).total_seconds() / 60.0
                    if elapsed_minutes >= interval_minutes:
                        should_sync = True

                if should_sync:
                    try:
                        print(f"[Telematics Scheduler] Auto-syncing StarLine for vehicle #{v.id} ({v.make} {v.model}) [Interval: {interval_minutes}m]...")
                        await StarLineService.sync_vehicle_with_starline(session, v)
                    except Exception as ex:
                        print(f"[Telematics Scheduler] Sync failed for vehicle #{v.id}: {ex}")
        except Exception as e:
            print(f"[Telematics Scheduler] Error checking vehicles: {e}")

async def start_telematics_background_worker():
    """
    Infinite background loop that runs every 60 seconds to check vehicle sync timers.
    """
    print("[Telematics Scheduler] Background auto-sync worker started.")
    # Initial pause on startup to let DB initialize
    await asyncio.sleep(15)
    while True:
        try:
            await check_and_sync_all_vehicles()
        except asyncio.CancelledError:
            print("[Telematics Scheduler] Worker shutting down...")
            break
        except Exception as e:
            print(f"[Telematics Scheduler] Worker loop error: {e}")
        
        # Check every 60 seconds
        try:
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            print("[Telematics Scheduler] Worker sleep cancelled, shutting down...")
            break
