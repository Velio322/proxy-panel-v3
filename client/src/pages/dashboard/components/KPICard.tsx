import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: number;
  accentColor?: string;
  onClick?: () => void;
}

export function KPICard({ label, value, sub, icon, trend, accentColor = '#6366f1', onClick }: KPICardProps) {
  const trendColor = trend == null ? 'text-fg-subtle' :
                     trend > 0    ? 'text-emerald-500' :
                     trend < 0    ? 'text-danger' : 'text-fg-subtle';
  const TrendIcon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;

  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 rounded-2xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.01]`}
    >
      {/* Top subtle light ray */}
      <div
        className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-40"
        style={{ background: accentColor }}
      />

      {/* Top Row: Label & Icon */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-fg-muted tracking-tight">{label}</span>
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:rotate-6"
            style={{
              background: `${accentColor}18`,
              color: accentColor,
              border: `1px solid ${accentColor}30`,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-2xl font-extrabold text-fg tracking-tight font-mono mb-1.5">
        {value}
      </div>

      {/* Subtitle & Trend */}
      <div className="flex items-center justify-between text-xs text-fg-subtle">
        {sub && <span className="truncate">{sub}</span>}
        {trend != null && (
          <div className={`flex items-center gap-1 font-semibold ${trendColor} shrink-0 ml-2`}>
            <TrendIcon size={12} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>

      {/* Bottom accent glow strip */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="glass-card p-5 rounded-2xl animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-20 bg-bg-raised rounded-md" />
        <div className="w-8 h-8 rounded-xl bg-bg-raised" />
      </div>
      <div className="h-7 w-28 bg-bg-raised rounded-lg mb-2" />
      <div className="h-3 w-36 bg-bg-raised rounded-md" />
    </div>
  );
}
