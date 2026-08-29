import React from 'react';

interface ProgressBarProps {
  percentage: number;
  status: 'ok' | 'due_soon' | 'overdue';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, status }) => {
  const clamped = Math.min(100, Math.max(0, percentage));

  let barColor = 'bg-emerald-500';
  let glowColor = 'shadow-emerald-500/30';

  if (status === 'overdue' || percentage >= 100) {
    barColor = 'bg-rose-500';
    glowColor = 'shadow-rose-500/40';
  } else if (status === 'due_soon' || percentage >= 75) {
    barColor = 'bg-amber-400';
    glowColor = 'shadow-amber-400/30';
  }

  return (
    <div className="w-full bg-dark-750 rounded-full h-2 overflow-hidden relative">
      <div
        className={`h-full rounded-full transition-all duration-500 shadow-sm ${barColor} ${glowColor}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
