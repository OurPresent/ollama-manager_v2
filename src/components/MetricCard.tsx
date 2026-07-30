import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accentColor?: 'green' | 'blue' | 'amber' | 'rose' | 'sky';
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtext, accentColor = 'green' }) => {
  const borderColors = {
    green: 'border-emerald-200 dark:border-zinc-800/80 hover:border-emerald-500 dark:hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
    blue: 'border-blue-200 dark:border-zinc-800/80 hover:border-blue-500 dark:hover:border-blue-500/40 text-blue-600 dark:text-blue-400',
    amber: 'border-amber-200 dark:border-zinc-800/80 hover:border-amber-500 dark:hover:border-amber-500/40 text-amber-600 dark:text-amber-400',
    rose: 'border-rose-200 dark:border-zinc-800/80 hover:border-rose-500 dark:hover:border-rose-500/40 text-rose-600 dark:text-rose-400',
    sky: 'border-sky-200 dark:border-zinc-800/80 hover:border-sky-500 dark:hover:border-sky-500/40 text-sky-600 dark:text-sky-400',
  };

  return (
    <div className={`bg-white/80 dark:bg-zinc-900/60 border ${borderColors[accentColor]} rounded-xl p-4 transition-all duration-200`}>
      <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{label}</span>
      <h3 className="text-2xl font-mono font-bold text-zinc-800 dark:text-zinc-100 mt-1">{value}</h3>
      {subtext && <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500 mt-0.5">{subtext}</p>}
    </div>
  );
};