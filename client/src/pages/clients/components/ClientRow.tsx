import { useState } from 'react';
import { Client } from '@/lib/api';
import { formatBytes, formatDate, cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { 
  AlertTriangle, Link2, Copy, Check, MoreVertical, 
  Settings2, RotateCcw, Ban, Trash2 
} from 'lucide-react';
import { protocolColor, buildSubUrl } from '../utils';

interface ClientRowProps {
  client: Client;
  onSub: () => void;
  onEdit: () => void;
  onBan: () => void;
  onDelete: () => void;
  onResetTraffic: () => void;
}

export function ClientRow({ client: c, onSub, onEdit, onBan, onDelete, onResetTraffic }: ClientRowProps) {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const trafficPct = c.trafficLimit > 0 ? Math.min((Number(c.usedTraffic) / Number(c.trafficLimit)) * 100, 100) : 0;
  const isExpiring = c.expireAt && new Date(c.expireAt).getTime() - Date.now() < 7 * 86400000 && new Date(c.expireAt) > new Date();
  const isExpired = c.expireAt && new Date(c.expireAt) < new Date();
  const isNearLimit = trafficPct > 80;

  const copySub = () => {
    navigator.clipboard.writeText(buildSubUrl(c.subToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr className={cn("group hover:bg-bg-raised transition-colors border-b border-border-subtle last:border-0", c.banned && "bg-bg-raised/50")}>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold shadow-sm",
            c.banned ? "bg-bg-raised text-fg-subtle" : "text-white"
          )}
          style={!c.banned ? { background: 'var(--surface-invert)' } : undefined}>
            {c.username[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-fg truncate">{c.username}</span>
              {c.banned && <AlertTriangle size={12} className="text-rose-500 shrink-0" />}
            </div>
            <div className="text-[11px] text-fg-subtle font-mono truncate max-w-[120px]">{c.uuid}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1">
          {(c.protocols || []).slice(0, 2).map((p) => (
            <span key={p} className={cn("px-2 py-0.5 rounded text-[10px] font-semibold border", protocolColor(p))}>{p}</span>
          ))}
          {(c.protocols || []).length > 2 && (
            <span className="px-2 py-0.5 rounded text-[10px] text-fg-muted bg-bg-raised border border-border">+{(c.protocols || []).length - 2}</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn("font-semibold", isNearLimit ? "text-amber-600" : "text-fg")}>
              {formatBytes(Number(c.usedTraffic))}
            </span>
            <span className="text-fg-subtle">/</span>
            <span className="text-fg-muted">{c.trafficLimit > 0 ? formatBytes(Number(c.trafficLimit)) : '∞'}</span>
          </div>
          {c.trafficLimit > 0 && (
            <div className="w-24 h-1.5 bg-bg-raised rounded-full overflow-hidden border border-border/50">
              <div className={cn("h-full transition-all",
                trafficPct > 90 ? "" : trafficPct > 70 ? "bg-amber-500" : ""
              )} style={{ width: `${trafficPct}%`, background: trafficPct > 90 ? 'var(--danger)' : trafficPct > 70 ? undefined : 'var(--surface-invert)' }} />
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5">
        {c.expireAt ? (
          <div className={cn("text-xs font-medium", isExpired ? "text-rose-600" : isExpiring ? "text-amber-600" : "text-fg")}>
            <div>{formatDate(c.expireAt)}</div>
            {isExpiring && !isExpired && <div className="text-[10px] text-amber-500 uppercase tracking-tight font-bold">{t('clients.expiringSoon')}</div>}
            {isExpired && <div className="text-[10px] text-rose-500 uppercase tracking-tight font-bold">{t('clients.expired')}</div>}
          </div>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        )}
      </td>

      <td className="px-4 py-3.5">
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
          c.banned ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", c.banned ? "bg-rose-500" : "bg-emerald-500")} />
          {c.banned ? t('common.banned') : t('common.active')}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={onSub} className="p-2 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border">
            <Link2 size={14} />
          </button>
          <button onClick={copySub} className="p-2 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border">
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg transition-all shadow-sm border border-transparent hover:border-border">
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-44 bg-surface border border-border rounded-lg shadow-xl z-20 py-1.5 animate-in fade-in slide-in-from-top-1">
                  <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                    <Settings2 size={14} className="text-fg-subtle" /> {t('clients.edit')}
                  </button>
                  <button onClick={() => { onResetTraffic(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                    <RotateCcw size={14} className="text-fg-subtle" /> {t('clients.resetTraffic')}
                  </button>
                  <button onClick={() => { onBan(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-fg hover:bg-bg-raised flex items-center gap-2.5 transition-colors">
                    <Ban size={14} className="text-fg-subtle" /> {c.banned ? t('clients.unban') : t('clients.ban')}
                  </button>
                  <div className="border-t border-border-subtle my-1" />
                  <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors font-medium">
                    <Trash2 size={14} /> {t('clients.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
