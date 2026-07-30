import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accentColor?: 'green' | 'blue' | 'amber' | 'rose';
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtext, accentColor = 'green' }) => {
  const borderColors = {
    green: 'hover:border-emerald-500/40 text-emerald-400',
    blue: 'hover:border-blue-500/40 text-blue-400',
    amber: 'hover:border-amber-500/40 text-amber-400',
    rose: 'hover:border-rose-500/40 text-rose-400',
  };

  return (
    <div className={`bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 transition-all duration-200 ${borderColors[accentColor]}`}>
      <span className="text-xs font-mono text-zinc-400">{label}</span>
      <h3 className="text-2xl font-mono font-bold text-zinc-100 mt-1">{value}</h3>
      {subtext && <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{subtext}</p>}
    </div>
  );
};