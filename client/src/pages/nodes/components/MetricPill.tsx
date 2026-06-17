import { cn } from '@/lib/utils';

interface MetricPillProps {
  label: string;
  value?: number | null;
  suffix?: string;
  warn?: boolean;
}

export function MetricPill({ label, value, suffix = '%', warn }: MetricPillProps) {
  return (
    <div className="bg-bg-raised border border-border/50 rounded-lg px-2 py-1.5 flex flex-col items-center justify-center shadow-sm">
      <div className="text-[9px] text-fg-subtle uppercase tracking-widest font-bold mb-0.5">{label}</div>
      <div className={cn(
        "text-[12px] font-bold tabular-nums leading-none",
        warn ? "text-rose-600" : "text-fg"
      )}>
        {value != null ? `${value.toFixed(suffix === 'ms' ? 0 : 1)}${suffix}` : '—'}
      </div>
    </div>
  );
}
