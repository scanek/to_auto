from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.fuel import FuelLog
from app.models.vehicle import Vehicle

async def recalculate_fuel_logs(session: AsyncSession, vehicle_id: int):
    """
    Recalculates fuel consumption for all fuel logs of a vehicle in chronological order.
    When filling full tank to full tank:
    The fuel consumed between prev_fill and current_fill is the amount added at current_fill.
    If there were partial fills in between, their amounts are accumulated until the next full tank fill.
    """
    query = select(FuelLog).where(FuelLog.vehicle_id == vehicle_id).order_by(FuelLog.odometer.asc(), FuelLog.date.asc())
    result = await session.execute(query)
    logs = result.scalars().all()

    prev_log = None
    accumulated_fuel = 0.0

    for log in logs:
        if prev_log is None or log.is_missed:
            log.distance_traveled = None
            log.consumption = None
            accumulated_fuel = 0.0
        else:
            dist = log.odometer - prev_log.odometer
            if dist > 0:
                log.distance_traveled = dist
                accumulated_fuel += log.fuel_amount
                if log.is_full_tank:
                    # Calculate consumption for the distance since last full tank
                    log.consumption = round((accumulated_fuel / dist) * 100.0, 2)
                    accumulated_fuel = 0.0
                else:
                    log.consumption = None
            else:
                log.distance_traveled = None
                log.consumption = None

        prev_log = log

    await session.commit()
