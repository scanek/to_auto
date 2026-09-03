from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.fuel import FuelLog
from app.models.vehicle import Vehicle

async def recalculate_fuel_logs(session: AsyncSession, vehicle_id: int):
    """
    Recalculates fuel consumption for all fuel logs of a vehicle in chronological order.
    Rules:
    1. The very first fuel log in history (or any log marked as missed/gap) acts as the INITIAL ANCHOR / BASELINE.
       Consumption cannot be calculated for the first log because previous fuel consumption is unknown.
       distance_traveled = None, consumption = None.
    2. Subsequent fuel logs:
       dist = current_log.odometer - last_full_log.odometer
       accumulated_fuel += current_log.fuel_amount
       If current_log.is_full_tank:
           consumption = round((accumulated_fuel / dist) * 100.0, 2)
           accumulated_fuel = 0.0
       Else (partial fill):
           consumption = None
    """
    query = select(FuelLog).where(FuelLog.vehicle_id == vehicle_id).order_by(FuelLog.odometer.asc(), FuelLog.date.asc())
    result = await session.execute(query)
    logs = result.scalars().all()

    prev_log = None
    last_full_log = None
    accumulated_fuel = 0.0

    for log in logs:
        if prev_log is None or log.is_missed:
            # First log in series / gap -> acts as baseline anchor
            log.distance_traveled = None
            log.consumption = None
            if log.is_full_tank:
                last_full_log = log
                accumulated_fuel = 0.0
            else:
                last_full_log = None
                accumulated_fuel = (log.fuel_amount or 0.0)
        else:
            dist_since_prev = log.odometer - prev_log.odometer
            log.distance_traveled = dist_since_prev if dist_since_prev > 0 else None
            accumulated_fuel += (log.fuel_amount or 0.0)

            if log.is_full_tank and last_full_log and log.odometer > last_full_log.odometer:
                total_dist = log.odometer - last_full_log.odometer
                log.consumption = round((accumulated_fuel / total_dist) * 100.0, 2)
                accumulated_fuel = 0.0
                last_full_log = log
            elif log.is_full_tank:
                # First full tank after partials with no prior full anchor
                log.consumption = None
                accumulated_fuel = 0.0
                last_full_log = log
            else:
                # Partial tank fill
                log.consumption = None

        prev_log = log

    await session.commit()

