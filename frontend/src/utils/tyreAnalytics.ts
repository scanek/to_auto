export interface DotCodeAnalysis {
  isValid: boolean;
  raw: string;
  week: number;
  year: number;
  ageYears: number;
  ageMonths: number;
  status: 'fresh' | 'normal' | 'attention' | 'critical';
  statusLabel: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  recommendation: string;
}

export function parseDotCode(dot?: string): DotCodeAnalysis | null {
  if (!dot) return null;

  // Extract all 4 consecutive digits
  const match = dot.match(/(\d{4})/);
  if (!match) return null;

  const code = match[1];
  const week = parseInt(code.slice(0, 2), 10);
  const yearSuffix = parseInt(code.slice(2), 10);

  if (isNaN(week) || isNaN(yearSuffix) || week < 1 || week > 53) {
    return null;
  }

  const fullYear = yearSuffix <= 70 ? 2000 + yearSuffix : 1900 + yearSuffix;
  const now = new Date();
  
  // Approximate date of tire production
  const productionDate = new Date(fullYear, 0, 1 + (week - 1) * 7);
  const diffMs = now.getTime() - productionDate.getTime();
  const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  const ageYears = diffDays / 365.25;
  const ageMonths = Math.round((ageYears - Math.floor(ageYears)) * 12);

  let status: 'fresh' | 'normal' | 'attention' | 'critical';
  let statusLabel: string;
  let badgeBg: string;
  let badgeColor: string;
  let badgeBorder: string;
  let recommendation: string;

  if (ageYears < 3.0) {
    status = 'fresh';
    statusLabel = 'Свежая (до 3 лет)';
    badgeBg = 'bg-emerald-50 dark:bg-emerald-950/30';
    badgeColor = 'text-emerald-700 dark:text-emerald-400';
    badgeBorder = 'border-emerald-200 dark:border-emerald-800';
    recommendation = 'Компаунд в идеальном состоянии, максимальная эластичность и надежное сцепление.';
  } else if (ageYears < 5.0) {
    status = 'normal';
    statusLabel = 'Норма (3–5 лет)';
    badgeBg = 'bg-amber-50 dark:bg-amber-950/30';
    badgeColor = 'text-amber-700 dark:text-amber-400';
    badgeBorder = 'border-amber-200 dark:border-amber-800';
    recommendation = 'Рабочий возраст шин. Рекомендуется регулярная проверка давления и глубины протектора.';
  } else if (ageYears < 7.0) {
    status = 'attention';
    statusLabel = 'Внимание (5–7 лет)';
    badgeBg = 'bg-orange-50 dark:bg-orange-950/30';
    badgeColor = 'text-orange-700 dark:text-orange-400';
    badgeBorder = 'border-orange-200 dark:border-orange-800';
    recommendation = 'Резина начинает стареть и терять сцепные свойства на мокром асфальте. Контролируйте микротрещины.';
  } else {
    status = 'critical';
    statusLabel = 'Критический (> 7 лет)';
    badgeBg = 'bg-rose-50 dark:bg-rose-950/30';
    badgeColor = 'text-rose-700 dark:text-rose-400';
    badgeBorder = 'border-rose-200 dark:border-rose-800';
    recommendation = 'Шинам более 7 лет. Высокий риск расслоения корда и потери сцепления. Заводы рекомендуют замену комплекта.';
  }

  return {
    isValid: true,
    raw: code,
    week,
    year: fullYear,
    ageYears: Math.round(ageYears * 10) / 10,
    ageMonths,
    status,
    statusLabel,
    badgeBg,
    badgeColor,
    badgeBorder,
    recommendation,
  };
}

export interface RotationAnalysis {
  kmSinceRotation: number;
  kmRemaining: number;
  isOverdue: boolean;
  progressPercent: number;
  statusText: string;
}

export function getRotationAnalysis(
  currentOdometer: number,
  lastRotationKm?: number | null,
  rotationIntervalKm: number = 10000
): RotationAnalysis {
  const effectiveLastKm = lastRotationKm ?? 0;
  const kmSinceRotation = Math.max(0, currentOdometer - effectiveLastKm);
  const kmRemaining = rotationIntervalKm - kmSinceRotation;
  const isOverdue = kmRemaining <= 0;
  const progressPercent = Math.min(100, Math.max(0, (kmSinceRotation / rotationIntervalKm) * 100));

  let statusText = '';
  if (lastRotationKm === null || lastRotationKm === undefined) {
    statusText = 'Перестановка колес еще не фиксировалась';
  } else if (isOverdue) {
    statusText = `Срочно требуется ротация! Просрочено на ${Math.abs(kmRemaining).toLocaleString()} км`;
  } else {
    statusText = `До следующей перестановки: ${kmRemaining.toLocaleString()} км`;
  }

  return {
    kmSinceRotation,
    kmRemaining,
    isOverdue,
    progressPercent,
    statusText,
  };
}

export interface RotationSchemeInfo {
  name: string;
  description: string;
  moves: Array<{ from: 'FL' | 'FR' | 'RL' | 'RR'; to: 'FL' | 'FR' | 'RL' | 'RR'; label: string }>;
}

export function getRotationScheme(
  driveType: string = 'fwd',
  isDirectional: boolean = false
): RotationSchemeInfo {
  if (isDirectional) {
    return {
      name: 'Схема для направленных шин (Directional)',
      description:
        'Колеса меняются строго по одной стороне (перед ↔ зад) без смены направления вращения.',
      moves: [
        { from: 'FL', to: 'RL', label: 'Переднее левое → Заднее левое' },
        { from: 'RL', to: 'FL', label: 'Заднее левое → Переднее левое' },
        { from: 'FR', to: 'RR', label: 'Переднее правое → Заднее правое' },
        { from: 'RR', to: 'FR', label: 'Заднее правое → Переднее правое' },
      ],
    };
  }

  const normalizedDrive = (driveType || 'fwd').toLowerCase();

  if (normalizedDrive === 'fwd') {
    return {
      name: 'Схема Forward Cross (Передний привод)',
      description:
        'Передние колеса уходят прямо назад. Задние колеса перекрещиваются на противоположные позиции спереди.',
      moves: [
        { from: 'FL', to: 'RL', label: 'Переднее левое → Заднее левое' },
        { from: 'FR', to: 'RR', label: 'Переднее правое → Заднее правое' },
        { from: 'RL', to: 'FR', label: 'Заднее левое ↗ Переднее правое' },
        { from: 'RR', to: 'FL', label: 'Заднее правое ↖ Переднее левое' },
      ],
    };
  }

  // AWD / 4WD / RWD
  return {
    name: 'Схема Rearward Cross (Полный / Задний привод)',
    description:
      'Задние колеса уходят прямо вперед. Передние колеса перекрещиваются на противоположные позиции сзади.',
    moves: [
      { from: 'RL', to: 'FL', label: 'Заднее левое → Переднее левое' },
      { from: 'RR', to: 'FR', label: 'Заднее правое → Переднее правое' },
      { from: 'FL', to: 'RR', label: 'Переднее левое ↘ Заднее правое' },
      { from: 'FR', to: 'RL', label: 'Переднее правое ↙ Заднее левое' },
    ],
  };
}
