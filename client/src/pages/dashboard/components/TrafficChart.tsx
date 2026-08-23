import { useI18n } from '@/i18n';
import { formatBytes } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface/95 border border-border rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md animate-fade-in">
      <p className="text-xs font-semibold text-fg-subtle mb-2">
        {label ? new Date(label).toLocaleDateString('en', { month: 'short', day: 'numeric', weekday: 'short' }) : ''}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-3 text-xs mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-fg-muted capitalize">{p.name}:</span>
          <span className="font-bold font-mono text-fg ml-auto pl-3">
            {formatBytes(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface TrafficChartProps {
  data: any[];
  period: number;
  onPeriodChange: (days: number) => void;
}

export function TrafficChart({ data, period, onPeriodChange }: TrafficChartProps) {
  const { t } = useI18n();

  const totalUp = data.reduce((s, d) => s + (d.upload || 0), 0);
  const totalDown = data.reduce((s, d) => s + (d.download || 0), 0);

  return (
    <div className="lg:col-span-2 glass-card p-6 rounded-2xl flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-bold text-fg tracking-tight">
            {t('dashboard.trafficOverview')}
          </h2>
          <p className="text-xs text-fg-subtle mt-0.5">
            Real-time aggregate bandwidth consumption
          </p>
        </div>

        {/* Stats + Period */}
        <div className="flex items-center gap-3">
          {/* Mini stats */}
          <div className="hidden sm:flex items-center gap-3 pr-3 border-r border-border">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ArrowUpRight size={13} />
              <span className="text-xs font-mono font-semibold">
                {formatBytes(totalUp)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <ArrowDownLeft size={13} />
              <span className="text-xs font-mono font-semibold">
                {formatBytes(totalDown)}
              </span>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-sunken border border-border">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => onPeriodChange(d)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  period === d
                    ? 'bg-accent text-white shadow-sm shadow-accent/25'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-60 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data || []} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'Inter' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'Inter' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => formatBytes(v, 0)}
              width={58}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: 'rgba(99, 102, 241, 0.3)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone" dataKey="upload" name="Upload"
              stroke="#6366f1" fill="url(#upGrad)" strokeWidth={2.5} dot={false}
            />
            <Area
              type="monotone" dataKey="download" name="Download"
              stroke="#38bdf8" fill="url(#downGrad)" strokeWidth={2.5} dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 text-xs font-semibold text-fg-muted">
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
          {t('dashboard.upload')}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
          {t('dashboard.download')}
        </span>
      </div>
    </div>
  );
}
