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

  const trafficPct = c.trafficLimit > 0n ? Math.min((Number(c.usedTraffic) / Number(c.trafficLimit)) * 100, 100) : 0;
  const isExpiring = c.expireAt && new Date(c.expireAt).getTime() - Date.now() < 7 * 86400000 && new Date(c.expireAt) > new Date();
  const isExpired = c.expireAt && new Date(c.expireAt) < new Date();
  const isNearLimit = trafficPct > 80;

  const copySub = () => {
    navigator.clipboard.writeText(buildSubUrl(c.subToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr className={cn(
      "group hover:bg-surface-hover/70 transition-colors border-b border-border/50 last:border-0",
      c.banned && "bg-danger-muted/10 opacity-75"
    )}>
      {/* User info */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm shrink-0",
            c.banned
              ? "bg-bg-sunken text-fg-subtle border border-border"
              : "bg-gradient-to-tr from-indigo-600 to-sky-400 text-white shadow-indigo-500/20"
          )}>
            {c.username[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-fg truncate">{c.username}</span>
              {c.banned && <AlertTriangle size={12} className="text-danger shrink-0" />}
            </div>
            <div className="text-[11px] text-fg-subtle font-mono truncate max-w-[140px]">{c.uuid}</div>
          </div>
        </div>
      </td>

      {/* Protocols */}
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1">
          {(c.protocols || []).slice(0, 2).map((p) => (
            <span key={p} className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold border", protocolColor(p))}>
              {p}
            </span>
          ))}
          {(c.protocols || []).length > 2 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] text-fg-muted bg-bg-sunken border border-border">
              +{(c.protocols || []).length - 2}
            </span>
          )}
        </div>
      </td>

      {/* Traffic */}
      <td className="px-5 py-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn("font-semibold font-mono", isNearLimit ? "text-amber-500" : "text-fg")}>
              {formatBytes(Number(c.usedTraffic))}
            </span>
            <span className="text-fg-subtle">/</span>
            <span className="text-fg-muted font-mono">{c.trafficLimit > 0n ? formatBytes(Number(c.trafficLimit)) : '∞'}</span>
          </div>
          {c.trafficLimit > 0n && (
            <div className="w-28 h-1.5 bg-bg-sunken rounded-full overflow-hidden border border-border/50">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  trafficPct > 90 ? "bg-danger" : trafficPct > 70 ? "bg-amber-500" : "bg-accent"
                )}
                style={{ width: `${trafficPct}%` }}
              />
            </div>
          )}
        </div>
      </td>

      {/* Expiry */}
      <td className="px-5 py-4">
        {c.expireAt ? (
          <div className={cn("text-xs font-medium", isExpired ? "text-danger" : isExpiring ? "text-amber-500" : "text-fg")}>
            <div>{formatDate(c.expireAt)}</div>
            {isExpiring && !isExpired && <div className="text-[10px] text-amber-500 font-semibold">{t('clients.expiringSoon')}</div>}
            {isExpired && <div className="text-[10px] text-danger font-semibold">{t('clients.expired')}</div>}
          </div>
        ) : (
          <span className="text-xs text-fg-subtle font-mono">Unlimited</span>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
          c.banned
            ? "bg-danger-muted text-danger border-danger/20"
            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full", c.banned ? "bg-danger" : "bg-emerald-500")} />
          {c.banned ? t('common.banned') : t('common.active')}
        </span>
      </td>

      {/* Actions */}
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={onSub}
            title="Subscription Info"
            className="p-2 rounded-xl hover:bg-surface-hover text-fg-muted hover:text-accent transition-all border border-border/60 hover:border-accent/40 shadow-sm"
          >
            <Link2 size={14} />
          </button>
          <button
            onClick={copySub}
            title="Copy Subscription Link"
            className="p-2 rounded-xl hover:bg-surface-hover text-fg-muted hover:text-fg transition-all border border-border/60 shadow-sm"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-xl hover:bg-surface-hover text-fg-muted hover:text-fg transition-all border border-border/60 shadow-sm"
            >
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface/95 border border-border rounded-2xl shadow-2xl z-20 py-1.5 backdrop-blur-xl animate-fade-in">
                  <button
                    onClick={() => { onEdit(); setShowMenu(false); }}
                    className="w-full px-3.5 py-2 text-left text-xs text-fg hover:bg-surface-hover flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <Settings2 size={14} className="text-indigo-400" /> {t('clients.edit')}
                  </button>
                  <button
                    onClick={() => { onResetTraffic(); setShowMenu(false); }}
                    className="w-full px-3.5 py-2 text-left text-xs text-fg hover:bg-surface-hover flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <RotateCcw size={14} className="text-sky-400" /> {t('clients.resetTraffic')}
                  </button>
                  <button
                    onClick={() => { onBan(); setShowMenu(false); }}
                    className="w-full px-3.5 py-2 text-left text-xs text-fg hover:bg-surface-hover flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <Ban size={14} className="text-amber-400" /> {c.banned ? t('clients.unban') : t('clients.ban')}
                  </button>
                  <div className="border-t border-border/60 my-1" />
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full px-3.5 py-2 text-left text-xs text-danger hover:bg-danger-muted/30 flex items-center gap-2.5 transition-colors font-semibold"
                  >
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
