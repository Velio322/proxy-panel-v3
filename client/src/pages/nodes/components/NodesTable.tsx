import { useState } from 'react';
import { Node } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { 
  Copy, Check, Eye, Wifi, Zap, RotateCcw, Settings, Trash2,
  Square, CheckSquare
} from 'lucide-react';
import { protocolColor, statusColor, statusBg } from '../utils';

interface NodesTableProps {
  nodes: Node[];
  selected: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onCheck: (id: string) => void;
  onPush: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
  onDetail: (node: Node) => void;
  onEdit: (node: Node) => void;
}

export function NodesTable({
  nodes, selected, onSelect, onSelectAll,
  onCheck, onPush, onRestart, onDelete, onDetail, onEdit
}: NodesTableProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState('');

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const allSelected = nodes.length > 0 && selected.size === nodes.length;

  return (
    <div className="bg-surface/80 border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-bg-raised/40 text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
              <th className="px-5 py-3.5 w-10">
                <button onClick={onSelectAll} className="transition-transform active:scale-90 flex items-center">
                  {allSelected ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} className="text-fg-subtle" />}
                </button>
              </th>
              <th className="px-5 py-3.5 font-bold">{t('nodes.title')}</th>
              <th className="px-5 py-3.5 font-bold">{t('common.status')}</th>
              <th className="px-5 py-3.5 font-bold">{t('nodes.address')}</th>
              <th className="px-5 py-3.5 font-bold">{t('nodes.cpu')}</th>
              <th className="px-5 py-3.5 font-bold">{t('nodes.memory')}</th>
              <th className="px-5 py-3.5 font-bold">{t('nodes.inbounds')}</th>
              <th className="px-5 py-3.5 font-bold text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {nodes.map((n) => {
              const isOnline = n.status === 'ONLINE';
              const isError = n.status === 'ERROR';
              const protocols = [...new Set((n.inbounds || []).map((i) => i.protocol))];
              const inboundCount = n._count?.inbounds || n.inbounds?.length || 0;
              return (
                <tr key={n.id} className="hover:bg-surface-hover/70 transition-colors group">
                  <td className="px-5 py-4">
                    <button onClick={() => onSelect(n.id)} className="transition-transform active:scale-90 flex items-center">
                      {selected.has(n.id) ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} className="text-fg-subtle hover:text-fg" />}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-fg tracking-tight">{n.name}</span>
                      {n.version && <span className="text-[10px] font-mono font-semibold text-fg-subtle px-1.5 py-0.5 rounded-md bg-bg-sunken border border-border">v{n.version}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                      statusBg(n.status), statusColor(n.status)
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : isError ? "bg-rose-500" : "bg-zinc-500")} />
                      {n.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => copy(`${n.host}:${n.port}`, n.id)}
                      className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg font-mono transition-all"
                    >
                      {n.host}:{n.port}
                      {copied === n.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn("text-xs font-mono font-semibold", n.cpuUsage != null && n.cpuUsage > 80 ? "text-danger" : "text-fg")}>
                      {n.cpuUsage != null ? `${n.cpuUsage.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn("text-xs font-mono font-semibold", n.memUsage != null && n.memUsage > 80 ? "text-danger" : "text-fg")}>
                      {n.memUsage != null ? `${n.memUsage.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-fg">{inboundCount}</span>
                      <div className="flex gap-1">
                        {protocols.slice(0, 2).map((p) => (
                          <span key={p} className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-semibold border", protocolColor(p))}>{p}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => onDetail(n)} className="p-1.5 rounded-xl hover:bg-surface-hover text-fg-subtle hover:text-fg transition-all border border-border/60" title={t('nodes.details')}><Eye size={14} /></button>
                      <button onClick={() => onCheck(n.id)} className="p-1.5 rounded-xl hover:bg-surface-hover text-fg-subtle hover:text-fg transition-all border border-border/60" title={t('nodes.checkStatus')}><Wifi size={14} /></button>
                      <button onClick={() => onPush(n.id)} className="p-1.5 rounded-xl hover:bg-surface-hover text-fg-subtle hover:text-fg transition-all border border-border/60" title={t('nodes.pushConfig')}><Zap size={14} /></button>
                      <button onClick={() => onRestart(n.id)} className="p-1.5 rounded-xl hover:bg-surface-hover text-fg-subtle hover:text-fg transition-all border border-border/60" title={t('nodes.restart')}><RotateCcw size={14} /></button>
                      <button onClick={() => onEdit(n)} className="p-1.5 rounded-xl hover:bg-surface-hover text-fg-subtle hover:text-fg transition-all border border-border/60" title={t('nodes.edit')}><Settings size={14} /></button>
                      <button onClick={() => onDelete(n.id)} className="p-1.5 rounded-xl hover:bg-danger-muted/30 text-fg-subtle hover:text-danger transition-all border border-border/60" title={t('common.delete')}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
