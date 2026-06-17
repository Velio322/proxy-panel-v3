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
    <div className="animate-scale-in rounded-lg px-3.5 py-2.5 shadow-lg"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(8px)',
      }}>
      <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--fg-subtle)' }}>
        {label ? new Date(label).toLocaleDateString('en', { month: 'short', day: 'numeric', weekday: 'short' }) : ''}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2.5 text-[12px] mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span style={{ color: 'var(--fg-muted)' }} className="capitalize">{p.name}:</span>
          <span className="font-semibold font-mono ml-auto pl-3" style={{ color: 'var(--fg)' }}>
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
    <div className="lg:col-span-2 card p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>
            {t('dashboard.trafficOverview')}
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {t('dashboard.bandwidth')}
          </p>
        </div>

        {/* Stats + Period */}
        <div className="flex items-center gap-3">
          {/* Mini stats */}
          <div className="hidden sm:flex items-center gap-3 pr-3"
            style={{ borderRight: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <ArrowUpRight size={12} style={{ color: 'var(--accent)' }} />
              <span className="text-[12px] font-semibold font-mono" style={{ color: 'var(--fg)' }}>
                {formatBytes(totalUp)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft size={12} style={{ color: '#06b6d4' }} />
              <span className="text-[12px] font-semibold font-mono" style={{ color: 'var(--fg)' }}>
                {formatBytes(totalDown)}
              </span>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => onPeriodChange(d)}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                style={{
                  background: period === d ? 'var(--accent)' : 'transparent',
                  color: period === d ? 'white' : 'var(--fg-muted)',
                  boxShadow: period === d ? '0 2px 6px var(--accent-glow)' : 'none',
                }}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data || []} margin={{ top: 5, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fontWeight: 500, fill: 'var(--fg-subtle)', fontFamily: 'Inter' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 10, fontWeight: 500, fill: 'var(--fg-subtle)', fontFamily: 'Inter' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => formatBytes(v, 0)}
              width={58}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone" dataKey="upload" name="Upload"
              stroke="var(--accent)" fill="url(#upGrad)" strokeWidth={2} dot={false}
            />
            <Area
              type="monotone" dataKey="download" name="Download"
              stroke="#06b6d4" fill="url(#downGrad)" strokeWidth={2} dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 text-[11px] font-medium" style={{ color: 'var(--fg-muted)' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
          {t('dashboard.upload')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#06b6d4' }} />
          {t('dashboard.download')}
        </span>
      </div>
    </div>
  );
}
