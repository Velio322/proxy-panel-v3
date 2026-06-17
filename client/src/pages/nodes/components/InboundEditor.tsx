import { useState } from 'react';
import { ChevronDown, Trash2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { protocolColor } from '../utils';
import { MiniField } from './common';
import { PROTOCOLS, SECURITIES, TRANSPORTS, FINGERPRINTS, FLOWS, InboundForm } from '../types';

interface InboundEditorProps {
  inb: InboundForm;
  idx: number;
  onUpdate: (idx: number, key: keyof InboundForm, val: any) => void;
  onRemove: (idx: number) => void;
}

export function InboundEditor({ inb, idx, onUpdate, onRemove }: InboundEditorProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const isXray = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(inb.protocol);
  const isReality = inb.security === 'reality';

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm transition-all hover:border-border">
      <div 
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" 
        onClick={() => setExpanded(!expanded)}
      >
        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm", protocolColor(inb.protocol))}>
          {inb.protocol}
        </span>
        <span className="text-sm font-bold text-fg flex-1 truncate">{inb.tag}</span>
        <span className="text-[11px] font-bold text-fg-subtle font-mono">:{inb.port}</span>
        <ChevronDown size={14} className={cn("text-fg-subtle transition-transform duration-300", expanded && "rotate-180")} />
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(idx); }} 
          className="p-1.5 rounded-lg hover:bg-rose-50 text-fg-subtle hover:text-rose-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border-subtle animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-3 gap-3">
            <MiniField label="Protocol" value={inb.protocol} onChange={(v) => onUpdate(idx, 'protocol', v)} options={[...PROTOCOLS]} />
            <MiniField label="Tag" value={inb.tag} onChange={(v) => onUpdate(idx, 'tag', v)} />
            <MiniField label="Port" value={inb.port} onChange={(v) => onUpdate(idx, 'port', +v)} type="number" />
          </div>

          {isXray && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MiniField label="Security" value={inb.security} onChange={(v) => onUpdate(idx, 'security', v)} options={[...SECURITIES]} />
                <MiniField label="Transport" value={inb.transport} onChange={(v) => onUpdate(idx, 'transport', v)} options={[...TRANSPORTS]} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniField label="SNI" value={inb.sni} onChange={(v) => onUpdate(idx, 'sni', v)} placeholder="www.microsoft.com" />
                <MiniField label="Fingerprint" value={inb.fingerprint} onChange={(v) => onUpdate(idx, 'fingerprint', v)} options={[...FINGERPRINTS]} />
              </div>
              {inb.protocol === 'VLESS' && (
                <div className="w-1/2 pr-1.5">
                  <MiniField label="Flow" value={inb.flow} onChange={(v) => onUpdate(idx, 'flow', v)} options={[...FLOWS]} />
                </div>
              )}
              
              {isReality && (
                <div className="p-4 bg-bg-raised rounded-xl border border-border/50 space-y-4 shadow-inner">
                  <div className="text-[10px] text-fg font-bold flex items-center gap-2 uppercase tracking-widest">
                    <Shield size={12} className="text-fg-subtle" /> 
                    {t('nodes.realitySettings')}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniField label="Public Key" value={inb.realityPublicKey} onChange={(v) => onUpdate(idx, 'realityPublicKey', v)} placeholder="x25519 public key" />
                    <MiniField label="Short ID" value={inb.realityShortId} onChange={(v) => onUpdate(idx, 'realityShortId', v)} placeholder="hex string" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniField label="SpiderX" value={inb.realitySpiderX} onChange={(v) => onUpdate(idx, 'realitySpiderX', v)} placeholder="path obfuscation" />
                    <MiniField label="Dest" value={inb.realityDest} onChange={(v) => onUpdate(idx, 'realityDest', v)} placeholder="www.microsoft.com:443" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
