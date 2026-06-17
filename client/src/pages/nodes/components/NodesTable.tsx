import { useState } from 'react';
import { Node } from '@/lib/api';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { 
  Square, CheckSquare, Copy, Check, Eye, 
  Wifi, Zap, Settings, Server, RotateCcw, Trash2 
} from 'lucide-react';
import { protocolColor, statusColor, statusBg } from '../utils';

interface NodesTableProps {
  nodes: Node[];
  selected: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  onCheck: (id: string) => void;
  onPush: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
  onDetail: (node: Node) => void;
  onEdit: (n: Node) => void;
}

export function NodesTable({
  nodes, selected, onSelect, onSelectAll, allSelected,
  onCheck, onPush, onRestart, onDelete, onDetail, onEdit
}: NodesTableProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState('');
  const copy = (text: string, label: string) => { 
    navigator.clipboard.writeText(text); 
    setCopied(label); 
    setTimeout(() => setCopied(''), 2000); 
  };

  if (nodes.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-16 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-raised border border-border-subtle flex items-center justify-center mb-6">
          <Server size={28} className="text-fg-subtle" />
        </div>
        <h3 className="text-sm font-bold text-fg">{t('nodes.noNodes')}</h3>
        <p className="text-xs text-fg-muted mt-1.5 mb-6 max-w-xs mx-auto leading-relaxed">{t('nodes.noNodesDesc')}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-raised/50 text-[10px] uppercase tracking-widest font-bold text-fg-subtle">
              <th className="w-10 px-4 py-3">
                <button onClick={onSelectAll} className="transition-transform active:scale-90">
                  {allSelected ? <CheckSquare size={16} className="text-fg" /> : <Square size={16} className="text-fg-subtle" />}
                </button>
              </th>
              <th className="text-left px-4 py-3 font-bold">{t('nodes.title')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('common.status')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('nodes.address')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('nodes.cpu')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('nodes.memory')}</th>
              <th className="text-left px-4 py-3 font-bold">{t('nodes.inbounds')}</th>
              <th className="text-right px-4 py-3 font-bold">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {nodes.map((n) => {
              const isOnline = n.status === 'ONLINE';
              const isError = n.status === 'ERROR';
              const protocols = [...new Set((n.inbounds || []).map((i) => i.protocol))];
              const inboundCount = n._count?.inbounds || n.inbounds?.length || 0;
              return (
                <tr key={n.id} className="hover:bg-bg-raised/50 transition-colors group border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3">
                    <button onClick={() => onSelect(n.id)} className="transition-transform active:scale-90">
                      {selected.has(n.id) ? <CheckSquare size={16} className="text-fg" /> : <Square size={16} className="text-fg-subtle hover:text-fg-subtle" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-fg tracking-tight">{n.name}</span>
                      {n.version && <span className="text-[9px] font-bold text-fg-subtle px-1 py-0.5 rounded bg-bg-raised">v{n.version}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      statusBg(n.status), statusColor(n.status)
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : isError ? "bg-rose-500" : "bg-bg-sunken")} />
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => copy(`${n.host}:${n.port}`, n.id)}
                      className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg font-mono transition-all">
                      {n.host}:{n.port}
                      {copied === n.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-bold tabular-nums", n.cpuUsage != null && n.cpuUsage > 80 ? "text-rose-600" : "text-fg")}>
                      {n.cpuUsage != null ? `${n.cpuUsage.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-bold tabular-nums", n.memUsage != null && n.memUsage > 80 ? "text-rose-600" : "text-fg")}>
                      {n.memUsage != null ? `${n.memUsage.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-fg">{inboundCount}</span>
                      <div className="flex gap-1">
                        {protocols.slice(0, 2).map((p) => (
                          <span key={p} className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold border", protocolColor(p))}>{p}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => onDetail(n)} className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border" title={t('nodes.details')}><Eye size={14} /></button>
                      <button onClick={() => onCheck(n.id)} className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border" title={t('nodes.checkStatus')}><Wifi size={14} /></button>
                      <button onClick={() => onPush(n.id)} className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border" title={t('nodes.pushConfig')}><Zap size={14} /></button>
                      <button onClick={() => onRestart(n.id)} className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border" title={t('nodes.restart')}><RotateCcw size={14} /></button>
                      <button onClick={() => onEdit(n)} className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border" title={t('nodes.edit')}><Settings size={14} /></button>
                      <button onClick={() => onDelete(n.id)} className="p-1.5 rounded-md hover:bg-red-50 text-fg-subtle hover:text-red-600 transition-all shadow-sm border border-transparent hover:border-red-200" title={t('common.delete')}><Trash2 size={14} /></button>
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
