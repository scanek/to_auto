import React, { useState, useRef, useEffect } from 'react';
import { Search, Copy, Check, ExternalLink, ChevronDown } from 'lucide-react';

interface PartArticleBadgeProps {
  article: string;
  brand?: string;
  name?: string;
  className?: string;
  showStoresDirectly?: boolean;
}

export const PartArticleBadge: React.FC<PartArticleBadgeProps> = ({
  article,
  brand,
  name,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cleanArticle = article.trim();
  if (!cleanArticle) return null;

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanArticle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const encodedArticle = encodeURIComponent(cleanArticle);
  const stores = [
    {
      name: 'Exist',
      icon: '⚙️',
      color: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
      url: `https://exist.ru/Price/?pcode=${encodedArticle}`,
    },
    {
      name: 'Автодок',
      icon: '🚗',
      color: 'hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400',
      url: `https://www.autodoc.ru/price/${encodedArticle}`,
    },
    {
      name: 'EMEX',
      icon: '📦',
      color: 'hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-400',
      url: `https://emex.ru/products/${encodedArticle}`,
    },
    {
      name: 'ZZap',
      icon: '⚡',
      color: 'hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400',
      url: `https://www.zzap.ru/public/search.aspx#rawdata=${encodedArticle}`,
    },
    {
      name: 'Ozon',
      icon: '🛍️',
      color: 'hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-400',
      url: `https://www.ozon.ru/search/?text=${encodedArticle}`,
    },
    {
      name: 'Wildberries',
      icon: '🟣',
      color: 'hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-400',
      url: `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodedArticle}`,
    },
  ];

  return (
    <div className={`relative inline-flex items-center text-xs ${className}`} ref={menuRef}>
      {/* Badge button */}
      <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-dark-700 bg-slate-100/90 dark:bg-dark-800 text-slate-800 dark:text-slate-200 shadow-2xs font-mono text-[11px] overflow-hidden transition-all hover:border-brand-500/50">
        <button
          type="button"
          onClick={handleCopy}
          className="px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-dark-750 flex items-center space-x-1 transition active:scale-95"
          title="Нажмите, чтобы скопировать артикул"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-500 animate-scale-up" />
          ) : (
            <Copy className="w-3 h-3 text-slate-400" />
          )}
          <span className="font-semibold font-mono tracking-tight">{cleanArticle}</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`px-1.5 py-0.5 border-l border-slate-200 dark:border-dark-700 transition flex items-center gap-0.5 ${
            isOpen
              ? 'bg-brand-500 text-white'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-750'
          }`}
          title="Найти цены в автомагазинах (Exist, Автодок, Emex, Ozon)"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <Search className="w-3 h-3" />
          <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Quick Search Popover */}
      {isOpen && (
        <div
          role="menu"
          className="absolute z-50 left-0 top-full mt-1.5 w-56 bg-white dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl shadow-xl p-1.5 text-xs animate-fadeIn space-y-1"
        >
          <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-dark-750/80 flex items-center justify-between">
            <span>Цены на запчасть</span>
            <span className="font-mono">{cleanArticle}</span>
          </div>

          <div className="grid grid-cols-2 gap-1 pt-0.5">
            {stores.map((store) => (
              <a
                key={store.name}
                href={store.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold border border-transparent hover:border-slate-200 dark:hover:border-dark-700 transition ${store.color}`}
              >
                <span>{store.icon}</span>
                <span className="truncate">{store.name}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-40 ml-auto flex-shrink-0" />
              </a>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full mt-1 px-2.5 py-1 text-[11px] rounded-lg bg-slate-50 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-750 flex items-center justify-center space-x-1.5 border border-slate-200/80 dark:border-dark-700 transition"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Скопировано в буфер!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Скопировать артикул</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
