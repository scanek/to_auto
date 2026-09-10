import React from 'react';
import { ExternalLink } from 'lucide-react';

export function detectStoreFromUrl(url: string): string | null {
  if (!url) return null;
  const lower = url.toLowerCase().trim();
  if (lower.includes('ozon.ru') || lower.includes('ozon.by') || lower.includes('ozon.kz')) return 'Ozon';
  if (lower.includes('wildberries.ru') || lower.includes('wb.ru')) return 'Wildberries';
  if (lower.includes('aliexpress.ru') || lower.includes('aliexpress.com')) return 'AliExpress';
  if (lower.includes('exist.ru')) return 'Exist';
  if (lower.includes('autodoc.ru')) return 'Автодок';
  if (lower.includes('emex.ru')) return 'EMEX';
  if (lower.includes('market.yandex.ru')) return 'Яндекс Маркет';
  if (lower.includes('megamarket.ru') || lower.includes('sbermegamarket.ru')) return 'Мегамаркет';
  if (lower.includes('avito.ru')) return 'Авито';
  if (lower.includes('drom.ru')) return 'Дром';
  if (lower.includes('zzap.ru')) return 'ZZap';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, '');
    return host;
  } catch {
    return null;
  }
}

interface StoreBadgeProps {
  store?: string;
  url?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

export const StoreBadge: React.FC<StoreBadgeProps> = ({
  store,
  url,
  size = 'xs',
  className = '',
}) => {
  if (!store && !url) return null;
  const label = store || (url ? detectStoreFromUrl(url) || 'Магазин' : '');
  if (!label) return null;

  const lower = label.toLowerCase();
  let theme = 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-dark-800 border-slate-200 dark:border-dark-700 hover:bg-slate-200 dark:hover:bg-dark-750';
  let icon = '🏢';

  if (lower.includes('ozon')) {
    theme = 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800/80 hover:bg-sky-100 dark:hover:bg-sky-900/60';
    icon = '🛍️';
  } else if (lower.includes('wildberries') || lower.includes('wb')) {
    theme = 'text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/60 border-fuchsia-200 dark:border-fuchsia-800/80 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/60';
    icon = '🟣';
  } else if (lower.includes('aliexpress')) {
    theme = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60';
    icon = '📦';
  } else if (
    lower.includes('exist') ||
    lower.includes('автодок') ||
    lower.includes('autodoc') ||
    lower.includes('emex')
  ) {
    theme = 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60';
    icon = '⚙️';
  } else if (lower.includes('маркет') || lower.includes('yandex')) {
    theme = 'text-amber-800 dark:text-amber-300 bg-yellow-50 dark:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800/80 hover:bg-yellow-100 dark:hover:bg-yellow-900/60';
    icon = '🟡';
  }

  const paddingClass =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-[11px]';

  const href = url
    ? url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`
    : undefined;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 font-semibold rounded-md border shadow-2xs transition-all active:scale-95 group/store shrink-0 ${paddingClass} ${theme} ${className}`}
        title={`Перейти в магазин: ${label}`}
      >
        <span className="text-[10px] leading-none">{icon}</span>
        <span className="underline-offset-2 group-hover/store:underline truncate max-w-[160px] sm:max-w-[220px]">
          {label}
        </span>
        <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover/store:opacity-100 shrink-0" />
      </a>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md border shrink-0 ${paddingClass} ${theme} ${className}`}
    >
      <span className="text-[10px] leading-none">{icon}</span>
      <span className="truncate max-w-[160px] sm:max-w-[220px]">{label}</span>
    </span>
  );
};
