import React from 'react';
import {
  LayoutDashboard,
  History,
  Wrench,
  Settings,
} from 'lucide-react';

export type MobileNavSection = 'dashboard' | 'timeline' | 'parts' | 'settings';

interface BottomNavProps {
  activeSection: MobileNavSection;
  onSelectSection: (section: MobileNavSection) => void;
  attentionCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeSection,
  onSelectSection,
  attentionCount = 0,
}) => {
  const navItems: Array<{
    id: MobileNavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: 'dashboard',
      label: 'Дашборд',
      icon: LayoutDashboard,
    },
    {
      id: 'timeline',
      label: 'Журнал',
      icon: History,
    },
    {
      id: 'parts',
      label: 'Запчасти',
      icon: Wrench,
      badge: attentionCount > 0 ? attentionCount : undefined,
    },
    {
      id: 'settings',
      label: 'Настройки',
      icon: Settings,
    },
  ];

  return (
    <nav
      aria-label="Мобильная навигация"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-[#090d16]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-[#27354f]/80 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.5)] pb-safe transition-colors"
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto px-1 relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className="relative flex flex-col items-center justify-center py-1 select-none active:scale-95 transition-transform"
              type="button"
            >
              {/* Active top indicator pill */}
              {isActive && (
                <span className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-brand-500 to-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.7)] animate-fadeIn" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
                    isActive
                      ? 'text-brand-500 dark:text-brand-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.4)] scale-110'
                      : 'text-slate-400 dark:text-slate-400'
                  }`}
                />

                {/* Optional Alert Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center shadow-sm shadow-rose-500/50">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] tracking-tight mt-1 transition-colors ${
                  isActive
                    ? 'font-bold text-brand-600 dark:text-brand-400'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
