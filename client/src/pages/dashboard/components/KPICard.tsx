import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: number; // percent change, positive = up
  accentColor?: string;
  onClick?: () => void;
}

export function KPICard({ label, value, sub, icon, trend, accentColor, onClick }: KPICardProps) {
  const trendColor = trend == null ? 'var(--fg-subtle)' :
                     trend > 0    ? 'var(--success)' :
                     trend < 0    ? 'var(--danger)' : 'var(--fg-subtle)';
  const TrendIcon = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const color = accentColor || 'var(--accent)';

  return (
    <div
      className="card kpi-card p-4 cursor-default select-none"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.borderColor = '';
        e.currentTarget.style.boxShadow = '';
      }}>

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-[12px] font-medium" style={{ color: 'var(--fg-muted)' }}>
          {label}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${color}18`, color }}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-[22px] font-bold tracking-tight leading-none mb-2"
        style={{ color: 'var(--fg)' }}>
        {value}
      </div>

      {/* Sub row */}
      <div className="flex items-center gap-2">
        {sub && (
          <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
            {sub}
          </span>
        )}
        {trend != null && (
          <div className="flex items-center gap-0.5 ml-auto">
            <TrendIcon size={11} style={{ color: trendColor }} />
            <span className="text-[11px] font-semibold" style={{ color: trendColor }}>
              {Math.abs(trend)}%
            </span>
          </div>
        )}
      </div>

      {/* Bottom accent bar */}
      <div className="mt-3 h-0.5 rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}40, transparent)` }} />
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton w-8 h-8 rounded-lg" />
      </div>
      <div className="skeleton h-7 w-20 rounded mb-2" />
      <div className="skeleton h-2.5 w-32 rounded" />
    </div>
  );
}
