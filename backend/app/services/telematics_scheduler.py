import asyncio
import datetime
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.vehicle import Vehicle
from app.services.starline_service import StarLineService
from app.core.logger import log

async def check_and_sync_all_vehicles():
    """
    Checks all vehicles with active StarLine telematics and syncs them if their
    configured auto-sync interval has elapsed.
    Includes Circuit-Breaker: pauses auto-sync after 5 consecutive failures.
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
            now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

            for v in vehicles:
                # Circuit breaker: if too many consecutive errors, skip background polling
                if (v.starline_consecutive_errors or 0) >= 5:
                    continue

                interval_minutes = v.starline_auto_sync_interval_minutes
                if interval_minutes is None:
                    interval_minutes = 60 if v.telematics_auto_sync else 0

                if interval_minutes <= 0:
                    continue  # Auto-sync disabled

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
                        log.info(f"[Telematics Scheduler] Auto-syncing StarLine for vehicle #{v.id} ({v.make} {v.model}) [Interval: {interval_minutes}m]...")
                        await StarLineService.sync_vehicle_with_starline(session, v)
                        v.starline_last_error = None
                        v.starline_consecutive_errors = 0
                        await session.commit()
                    except Exception as ex:
                        err_msg = str(ex)
                        log.warning(f"[Telematics Scheduler] Sync failed for vehicle #{v.id}: {err_msg}")
                        v.starline_last_error = err_msg[:500]
                        v.starline_consecutive_errors = (v.starline_consecutive_errors or 0) + 1
                        await session.commit()
        except Exception as e:
            log.error(f"[Telematics Scheduler] Error checking vehicles: {e}")

async def start_telematics_background_worker():
    """
    Infinite background loop that runs every 60 seconds to check vehicle sync timers.
    """
    log.info("[Telematics Scheduler] Background auto-sync worker started.")
    await asyncio.sleep(15)
    while True:
        try:
            await check_and_sync_all_vehicles()
            # Also check telegram proactive notifications (battery, low fuel, urgent TO)
            from app.services.telegram_service import check_and_send_scheduled_telegram_notifications
            await check_and_send_scheduled_telegram_notifications()
        except asyncio.CancelledError:
            log.info("[Telematics Scheduler] Worker shutting down...")
            break
        except Exception as e:
            log.error(f"[Telematics Scheduler] Worker loop error: {e}")
        
        try:
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            log.info("[Telematics Scheduler] Worker sleep cancelled, shutting down...")
            break

