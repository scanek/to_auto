import React from 'react';

export const TireIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2" />
    <path d="M12 19v2" />
    <path d="M3 12h2" />
    <path d="M19 12h2" />
    <path d="M5.63 5.63l1.42 1.42" />
    <path d="M16.95 16.95l1.42 1.42" />
    <path d="M5.63 18.37l1.42-1.42" />
    <path d="M16.95 7.05l1.42-1.42" />
  </svg>
);

export default TireIcon;
