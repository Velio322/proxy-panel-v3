import { useState } from 'react';
import { Node } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { 
  Server, Copy, Check, MoreVertical, 
  Eye, Wifi, Zap, RotateCcw, Settings, Trash2,
  Square, CheckSquare
} from 'lucide-react';
import { protocolColor, statusColor, statusBg } from '../utils';
import { MetricPill } from './MetricPill';

interface NodeCardProps {
  node: Node;
  selected: boolean;
  onSelect: () => void;
  onCheck: () => void;
  onPush: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onDetail: () => void;
  onEdit: () => void;
}

export function NodeCard({ 
  node: n, selected, onSelect, onCheck, onPush, onRestart, onDelete, onDetail, onEdit 
}: NodeCardProps) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState('');

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const isOnline = n.status === 'ONLINE';
  const isError = n.status === 'ERROR';
  const protocols = [...new Set((n.inbounds || []).map((i) => i.protocol))];
  const inboundCount = n._count?.inbounds || n.inbounds?.length || 0;

  return (
    <div className={cn(
      "group relative bg-surface border rounded-xl overflow-hidden transition-all duration-300 shadow-sm",
      "hover:shadow-md hover:border-border",
      selected ? "border-fg ring-1 ring-fg ring-offset-0" : "border-border"
    )}>
      {/* Header Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onSelect(); }} 
              className="mt-1 transition-transform active:scale-90"
            >
              {selected ? <CheckSquare size={16} className="text-fg" /> : <Square size={16} className="text-fg-subtle hover:text-fg-subtle" />}
            </button>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-fg truncate tracking-tight">{n.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 text-fg-subtle">
                <span className="text-[10px] font-mono truncate max-w-[120px]">{n.host}:{n.port}</span>
                <button onClick={() => copy(`${n.host}:${n.port}`, 'addr')} className="hover:text-fg-muted transition-colors">
                  {copied === 'addr' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border",
              statusBg(n.status), statusColor(n.status)
            )}>
              <span className={cn("w-1 h-1 rounded-full", isOnline ? "bg-emerald-500" : isError ? "bg-rose-500" : "bg-bg-sunken")} />
              {n.status}
            </span>
            <div className="relative">
              <button onClick={() => setMenu(!menu)} className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-border shadow-sm">
                <MoreVertical size={14} />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-40 bg-surface border border-border rounded-lg shadow-xl z-20 py-1.5 animate-in fade-in slide-in-from-top-1">
                    <button onClick={() => { onDetail(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                      <Eye size={14} className="text-fg-subtle" /> {t('nodes.details')}
                    </button>
                    <button onClick={() => { onCheck(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                      <Wifi size={14} className="text-fg-subtle" /> {t('nodes.checkStatus')}
                    </button>
                    <button onClick={() => { onPush(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                      <Zap size={14} className="text-fg-subtle" /> {t('nodes.pushConfig')}
                    </button>
                    <button onClick={() => { onRestart(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                      <RotateCcw size={14} className="text-fg-subtle" /> {t('nodes.restart')}
                    </button>
                    <button onClick={() => { onEdit(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                      <Settings size={14} className="text-fg-subtle" /> {t('nodes.edit')}
                    </button>
                    <div className="border-t border-border-subtle my-1" />
                    <button onClick={() => { onDelete(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors font-bold">
                      <Trash2 size={14} /> {t('nodes.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricPill label="CPU" value={n.cpuUsage} warn={n.cpuUsage != null && n.cpuUsage > 80} />
          <MetricPill label="MEM" value={n.memUsage} warn={n.memUsage != null && n.memUsage > 80} />
          <MetricPill label="PING" value={n.lastPingMs} suffix="ms" />
        </div>

        <div className="flex flex-wrap gap-1 mb-2 min-h-[1.5rem]">
          {protocols.map((p) => (
            <span key={p} className={cn("px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm", protocolColor(p))}>{p}</span>
          ))}
        </div>
      </div>

      <div className="px-4 py-2.5 bg-bg-raised border-t border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-fg-subtle font-bold uppercase tracking-tight">
          <span className="flex items-center gap-1 text-fg-muted"><Server size={10} /> {inboundCount}</span>
          <span className="text-zinc-200">|</span>
          <span>v{n.version || '0.0.0'}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-fg-subtle font-medium italic">
          {n.lastCheckAt ? new Date(n.lastCheckAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '—'}
        </div>
      </div>
    </div>
  );
}
