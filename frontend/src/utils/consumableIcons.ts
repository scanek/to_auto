export interface ConsumableItemIconMeta {
  icon: string;
  bg: string;
  color: string;
}

export const getConsumableItemIcon = (name: string, category: string = ''): ConsumableItemIconMeta => {
  const n = (name || '').toLowerCase();
  if (n.includes('масло') || n.includes('oil')) {
    return { icon: '🛢️', bg: 'bg-amber-500/15 text-amber-500 border border-amber-500/30', color: 'text-amber-500' };
  }
  if (n.includes('фильтр') || n.includes('filter')) {
    if (n.includes('масл') || n.includes('oil')) {
      return { icon: '💿', bg: 'bg-sky-500/15 text-sky-500 border border-sky-500/30', color: 'text-sky-500' };
    }
    if (n.includes('возд') || n.includes('air')) {
      return { icon: '🌪️', bg: 'bg-teal-500/15 text-teal-500 border border-teal-500/30', color: 'text-teal-500' };
    }
    if (n.includes('салон') || n.includes('cabin')) {
      return { icon: '🎛️', bg: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30', color: 'text-emerald-500' };
    }
    return { icon: '🌪️', bg: 'bg-teal-500/15 text-teal-500 border border-teal-500/30', color: 'text-teal-500' };
  }
  if (n.includes('свеч') || n.includes('spark') || n.includes('зажиган')) {
    return { icon: '⚡', bg: 'bg-amber-500/15 text-amber-500 border border-amber-500/30', color: 'text-amber-500' };
  }
  if (n.includes('антифриз') || n.includes('antifreeze') || n.includes('охлажд') || n.includes('тосол')) {
    return { icon: '🌡️', bg: 'bg-blue-500/15 text-blue-500 border border-blue-500/30', color: 'text-blue-500' };
  }
  if (n.includes('тормоз') || n.includes('brake') || n.includes('колодк') || n.includes('диск')) {
    return { icon: '🛑', bg: 'bg-rose-500/15 text-rose-500 border border-rose-500/30', color: 'text-rose-500' };
  }
  if (n.includes('аккум') || n.includes('акб') || n.includes('battery')) {
    return { icon: '🔋', bg: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30', color: 'text-emerald-500' };
  }
  if (n.includes('ремень') || n.includes('грм') || n.includes('цепь') || n.includes('belt')) {
    return { icon: '🔁', bg: 'bg-orange-500/15 text-orange-500 border border-orange-500/30', color: 'text-orange-500' };
  }
  if (n.includes('шин') || n.includes('колес') || n.includes('tyre') || n.includes('tire')) {
    return { icon: '🛞', bg: 'bg-sky-500/15 text-sky-500 border border-sky-500/30', color: 'text-sky-500' };
  }
  if (n.includes('дворник') || n.includes('щетк') || n.includes('wiper')) {
    return { icon: '🌧️', bg: 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30', color: 'text-cyan-500' };
  }
  if (n.includes('подвеск') || n.includes('стойк') || n.includes('амортиз') || n.includes('рычаг')) {
    return { icon: '🔩', bg: 'bg-slate-500/15 text-slate-500 border border-slate-500/30', color: 'text-slate-500' };
  }
  return { icon: '📦', bg: 'bg-purple-500/15 text-purple-500 border border-purple-500/30', color: 'text-purple-500' };
};
