import { useState } from 'react';
import { Inbound } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { Shield, Link2, Copy, Check, ChevronDown, ToggleRight, ToggleLeft, Settings, Trash2, Lock as LockIcon } from 'lucide-react';
import { protocolColor } from '../utils';

interface InboundRowProps {
  inbound: Inbound;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function InboundRow({ inbound: inb, expanded, onToggleExpand, onToggle, onEdit, onDelete }: InboundRowProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState('');
  const settings = inb.settings as Record<string, any>;
  const stream = inb.stream as Record<string, any>;
  const isXray = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(inb.protocol);
  const security = stream?.security || 'none';
  const transport = stream?.network || 'tcp';

  const copyAddr = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const fullAddr = `${inb.node?.host || '?'}:${inb.port}`;

  return (
    <div className={cn("transition-colors bg-surface", !inb.enable && "opacity-50")}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-bg-raised cursor-pointer" onClick={onToggleExpand}>
        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0", protocolColor(inb.protocol))}>{inb.protocol}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-fg truncate">{inb.tag}</span>
            {inb.remark && <span className="text-[10px] text-fg-muted font-medium truncate">({inb.remark})</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Address */}
          <button onClick={(e) => { e.stopPropagation(); copyAddr(fullAddr, 'addr'); }}
            className="flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg font-mono font-medium transition-colors">
            {fullAddr}
            {copied === 'addr' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>

          {/* Security badge */}
          <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
            security === 'reality' ? "bg-purple-50 border-purple-100 text-purple-600" :
            security === 'tls' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
            "bg-bg-raised border-border-subtle text-fg-muted"
          )}>
            {security === 'reality' ? <span className="flex items-center gap-1"><Shield size={10} /> Reality</span> :
             security === 'tls' ? <span className="flex items-center gap-1"><LockIcon size={10} /> TLS</span> :
             security}
          </span>

          {/* Transport */}
          <span className="px-2 py-0.5 rounded-md bg-bg-raised border border-border text-[9px] font-bold text-fg-muted uppercase tracking-widest">{transport}</span>

          {/* Port shares */}
          {inb.portShares && inb.portShares.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-600 font-bold text-[9px] uppercase tracking-widest">
              <Link2 size={10} /> {inb.portShares.length}
            </span>
          )}

          {/* Toggle */}
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="p-1 rounded-md hover:bg-bg-raised transition-colors">
            {inb.enable ?
              <ToggleRight size={20} className="text-emerald-500" /> :
              <ToggleLeft size={20} className="text-fg-subtle" />
            }
          </button>
        </div>

        <ChevronDown size={14} className={cn("text-fg-subtle transition-transform shrink-0", expanded && "rotate-180")} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-border-subtle bg-bg-raised/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {isXray && (
              <>
                <DetailBox label={t('inbounds.userUUID')} value={settings?.id || '—'} mono copyable />
                {settings?.flow && <DetailBox label={t('inbounds.flow')} value={settings.flow} mono />}
                <DetailBox label={t('inbounds.fingerprint')} value={stream?.fingerprint || '—'} />
                {stream?.sni && <DetailBox label={t('inbounds.sni')} value={stream.sni} mono copyable />}
              </>
            )}
            {!isXray && (
              <>
                <DetailBox label={t('inbounds.password')} value={settings?.password ? '••••••••' : '—'} />
                {settings?.sni && <DetailBox label={t('inbounds.sni')} value={settings.sni} mono />}
                <DetailBox label={t('inbounds.obfs')} value={settings?.obfs?.type || 'none'} />
              </>
            )}
            <DetailBox label={t('inbounds.port')} value={String(inb.port)} />
            <DetailBox label={t('inbounds.listen')} value={inb.listen || '0.0.0.0'} mono />
            <DetailBox label={t('inbounds.sniffing')} value={inb.sniffing ? t('common.enabled') : t('common.disabled')} />
          </div>

          {/* Port shares */}
          {inb.portShares && inb.portShares.length > 0 && (
            <div className="mb-4 pt-3 border-t border-border-subtle">
              <div className="text-[10px] font-bold text-fg-muted uppercase tracking-widest mb-2">{t('inbounds.portShares')} ({inb.portShares.length})</div>
              <div className="flex flex-wrap gap-2">
                {inb.portShares.map((ps) => (
                  <span key={ps.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-xs shadow-sm">
                    <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold", protocolColor(ps.protocol))}>{ps.protocol}</span>
                    <span className="font-bold text-fg">{ps.tag}</span>
                    {ps.host && <span className="text-fg-muted font-mono text-[11px]">@{ps.host}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-border-subtle">
            <button onClick={onEdit} className="px-4 py-2 rounded-lg bg-surface border border-border text-fg text-[11px] font-bold flex items-center gap-1.5 hover:bg-bg-raised hover:text-fg transition-all shadow-sm">
              <Settings size={14} /> {t('common.edit')}
            </button>
            <button onClick={onDelete} className="px-4 py-2 rounded-lg bg-surface border border-border text-rose-600 text-[11px] font-bold flex items-center gap-1.5 hover:bg-rose-50 transition-all shadow-sm">
              <Trash2 size={14} /> {t('common.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailBox({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div>
      <div className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-bold text-fg truncate", mono && "font-mono")}>{value}</span>
        {copyable && (
          <button onClick={copy} className="shrink-0 text-fg-subtle hover:text-fg-muted transition-colors bg-surface border border-border p-1 rounded-md shadow-sm">
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}
