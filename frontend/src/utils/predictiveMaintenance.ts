import { Vehicle, MaintenancePlan, FuelLog, ServiceRecord } from '../types';

export interface PredictiveMaintenanceResult {
  dailyMileage: number;
  estimatedDays: number;
  estimatedDate: Date;
  formattedDate: string;
  triggerReason: 'distance' | 'calendar' | 'hours';
  humanDescription: string;
}

/**
 * Calculates average daily mileage based on history of fuel logs or service records.
 * Falls back to 35 km/day if history is insufficient.
 */
export function calculateDailyMileage(
  vehicle: Vehicle,
  fuelLogs: FuelLog[] = [],
  serviceRecords: ServiceRecord[] = []
): number {
  const points: { date: number; odo: number }[] = [];

  // Collect odometer points from fuel logs
  for (const f of fuelLogs) {
    if (f.odometer && f.date) {
      const ts = new Date(f.date).getTime();
      if (!isNaN(ts)) {
        points.push({ date: ts, odo: f.odometer });
      }
    }
  }

  // Collect odometer points from service records
  for (const s of serviceRecords) {
    if (s.odometer && s.date) {
      const ts = new Date(s.date).getTime();
      if (!isNaN(ts)) {
        points.push({ date: ts, odo: s.odometer });
      }
    }
  }

  // Add current vehicle odometer if available
  if (vehicle.current_odometer) {
    points.push({ date: Date.now(), odo: vehicle.current_odometer });
  }

  points.sort((a, b) => a.date - b.date);

  // Compute daily mileage over the latest 90-180 days span
  if (points.length >= 2) {
    const oldest = points[0];
    const newest = points[points.length - 1];

    const daysDiff = (newest.date - oldest.date) / (1000 * 60 * 60 * 24);
    const odoDiff = newest.odo - oldest.odo;

    if (daysDiff >= 7 && odoDiff > 0) {
      const calculatedDaily = odoDiff / daysDiff;
      // Sanity check: between 3 km/day and 500 km/day
      if (calculatedDaily >= 3 && calculatedDaily <= 500) {
        return Math.round(calculatedDaily * 10) / 10;
      }
    }
  }

  // Fallback: estimate from purchase date or default to 35 km/day (~13,000 km/year)
  if (vehicle.purchase_date && vehicle.current_odometer && vehicle.starting_odometer !== undefined) {
    const pDate = new Date(vehicle.purchase_date).getTime();
    const daysSincePurchase = (Date.now() - pDate) / (1000 * 60 * 60 * 24);
    const drivenSincePurchase = vehicle.current_odometer - vehicle.starting_odometer;
    if (daysSincePurchase > 14 && drivenSincePurchase > 0) {
      const daily = drivenSincePurchase / daysSincePurchase;
      if (daily >= 3 && daily <= 400) {
        return Math.round(daily * 10) / 10;
      }
    }
  }

  return 35.0; // Standard urban/suburban average
}

/**
 * Predicts the exact calendar date when a maintenance plan will require service.
 * Takes the earliest between distance-based projection and calendar-month interval.
 */
export function getPredictiveDueDate(
  rem: MaintenancePlan,
  dailyMileage: number
): PredictiveMaintenanceResult | null {
  if (rem.status === 'overdue') {
    return null; // Already overdue
  }

  let daysByDistance: number | null = null;
  let daysByCalendar: number | null = null;

  if (rem.remaining_distance !== null && rem.remaining_distance !== undefined && rem.remaining_distance > 0) {
    daysByDistance = Math.max(1, Math.round(rem.remaining_distance / (dailyMileage || 35)));
  }

  if (rem.remaining_days !== null && rem.remaining_days !== undefined && rem.remaining_days > 0) {
    daysByCalendar = rem.remaining_days;
  }

  if (daysByDistance === null && daysByCalendar === null) {
    return null;
  }

  let finalDays = 0;
  let reason: 'distance' | 'calendar' = 'distance';

  if (daysByDistance !== null && daysByCalendar !== null) {
    if (daysByDistance <= daysByCalendar) {
      finalDays = daysByDistance;
      reason = 'distance';
    } else {
      finalDays = daysByCalendar;
      reason = 'calendar';
    }
  } else if (daysByDistance !== null) {
    finalDays = daysByDistance;
    reason = 'distance';
  } else if (daysByCalendar !== null) {
    finalDays = daysByCalendar;
    reason = 'calendar';
  }

  const estimatedDate = new Date(Date.now() + finalDays * 24 * 60 * 60 * 1000);
  const formattedDate = estimatedDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: estimatedDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });

  const humanDescription =
    finalDays <= 30
      ? `через ~${finalDays} дн. (ориент. ${formattedDate})`
      : finalDays <= 90
      ? `через ~${Math.round(finalDays / 30)} мес. (${formattedDate})`
      : `ориентировочно ${formattedDate}`;

  return {
    dailyMileage,
    estimatedDays: finalDays,
    estimatedDate,
    formattedDate,
    triggerReason: reason,
    humanDescription,
  };
}
