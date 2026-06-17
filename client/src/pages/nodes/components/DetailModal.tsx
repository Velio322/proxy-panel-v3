import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { nodesApi } from '@/lib/api';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { Cpu, HardDrive, Wifi, Terminal } from 'lucide-react';
import { Modal, TabBar } from './common';
import { NodeDetailProps } from '../types';
import { statusColor, statusBg, protocolColor } from '../utils';

export function DetailModal({ node: n, onClose }: NodeDetailProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'inbounds' | 'metrics'>('inbounds');

  const { data: inbounds } = useQuery({
    queryKey: ['node-inbounds', n.id],
    queryFn: () => nodesApi.getInbounds(n.id).then((r) => r.data),
  });

  const pushMut = useMutation({ mutationFn: () => nodesApi.pushConfig(n.id) });
  const restartMut = useMutation({ mutationFn: () => nodesApi.restart(n.id) });

  const isOnline = n.status === 'ONLINE';
  const isError = n.status === 'ERROR';

  return (
    <Modal onClose={onClose} title={n.name} maxW="max-w-2xl">
      {/* Status bar */}
      <div className="flex items-center gap-3 p-4 bg-bg-raised border border-border rounded-xl mb-6 shadow-sm">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
          statusBg(n.status), statusColor(n.status)
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : isError ? "bg-rose-500" : "bg-bg-sunken")} />
          {n.status}
        </span>
        <span className="text-[11px] text-fg-muted font-mono font-bold tracking-tight">{n.host}:{n.port}</span>
        {n.version && <span className="text-[10px] font-bold text-fg-subtle bg-surface px-1.5 py-0.5 rounded border border-border">v{n.version}</span>}
        <div className="flex-1" />
        <button onClick={() => pushMut.mutate()} disabled={pushMut.isPending}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[11px] font-bold hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-sm">
          {pushMut.isPending ? t('nodes.pushing') : t('nodes.pushConfig')}
        </button>
        <button onClick={() => restartMut.mutate()} disabled={restartMut.isPending}
          className="px-3 py-1.5 rounded-lg border border-border text-fg text-[11px] font-bold hover:bg-bg-raised disabled:opacity-50 transition-all shadow-sm">
          {restartMut.isPending ? t('nodes.restarting') : t('nodes.restart')}
        </button>
      </div>

      <TabBar tabs={['inbounds', 'metrics']} active={tab} onChange={(v) => setTab(v as any)} />

      <div className="max-h-[400px] overflow-y-auto">
        {tab === 'inbounds' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-right-2 duration-200">
            {inbounds && inbounds.length > 0 ? inbounds.map((inb) => (
              <div key={inb.id} className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl shadow-sm hover:border-border transition-colors">
                <span className={cn("w-2 h-2 rounded-full", inb.enable ? "bg-emerald-400" : "bg-bg-sunken")} />
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm", protocolColor(inb.protocol))}>{inb.protocol}</span>
                <span className="text-sm font-bold text-fg flex-1 truncate">{inb.tag}</span>
                <span className="text-[11px] font-bold text-fg-muted font-mono bg-bg-raised px-2 py-1 rounded-md border border-border-subtle">:{inb.port}</span>
              </div>
            )) : (
              <div className="text-xs font-medium text-fg-subtle text-center py-12 bg-bg-raised border border-border border-dashed rounded-xl">
                {t('nodes.noInboundsConfigured')}
              </div>
            )}
          </div>
        )}
        {tab === 'metrics' && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-2 duration-200">
            {[
              { label: t('nodes.cpu'), value: n.cpuUsage != null ? `${n.cpuUsage.toFixed(1)}%` : '—', icon: <Cpu size={16} /> },
              { label: t('nodes.memory'), value: n.memUsage != null ? `${n.memUsage.toFixed(1)}%` : '—', icon: <HardDrive size={16} /> },
              { label: t('nodes.lastCheck'), value: n.lastPingMs ? `${n.lastPingMs}ms` : '—', icon: <Wifi size={16} /> },
              { label: t('nodes.version'), value: n.version || '—', icon: <Terminal size={16} /> },
            ].map((m) => (
              <div key={m.label} className="bg-surface border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-fg-subtle mb-2">
                  {m.icon}
                  <span className="text-[10px] font-bold uppercase tracking-widest">{m.label}</span>
                </div>
                <div className="text-2xl font-black text-fg tracking-tight">{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
