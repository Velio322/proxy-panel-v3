import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesApi, inboundsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { Check, Loader2, PlusCircle, Info } from 'lucide-react';
import { Modal, TabBar, Field } from './common';
import { InboundEditor } from './InboundEditor';
import { InboundForm, NodeComponentProps } from '../types';

export function CreateNodeModal({ onClose }: NodeComponentProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'general' | 'inbounds' | 'advanced' | 'portsharing'>('general');
  const [created, setCreated] = useState(false);

  // General
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(443);
  const [apiPort, setApiPort] = useState(2087);
  const [secret, setSecret] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [isp, setIsp] = useState('');
  const [tags, setTags] = useState('');

  // Inbounds
  const [inbounds, setInbounds] = useState<InboundForm[]>([]);

  // Port-Sharing
  const [portShareEnabled, setPortShareEnabled] = useState(false);
  const [multiplexor, setMultiplexor] = useState<'haproxy' | 'nginx'>('haproxy');
  const [sharedPort, setSharedPort] = useState(443);

  const addInbound = () => {
    setInbounds([...inbounds, {
      protocol: 'VLESS', tag: `vless-${Date.now()}`, port: 10000 + inbounds.length,
      security: 'reality', sni: 'www.microsoft.com', fingerprint: 'chrome',
      flow: 'xtls-rprx-vision', transport: 'tcp',
      realityPublicKey: '', realityShortId: '', realitySpiderX: '', realityDest: 'www.microsoft.com:443',
    }]);
  };

  const updateInbound = (idx: number, key: keyof InboundForm, val: any) => {
    const updated = [...inbounds];
    (updated[idx] as any)[key] = val;
    setInbounds(updated);
  };

  const removeInbound = (idx: number) => {
    setInbounds(inbounds.filter((_, i) => i !== idx));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const node = await nodesApi.create({
        name, host, port, apiPort, secret,
        country: country || undefined, city: city || undefined, isp: isp || undefined,
        tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      });
      for (const inb of inbounds) {
        const password = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

        let settings: Record<string, any> = {};
        let stream: Record<string, any> = {};

        if (inb.protocol === 'VLESS') {
          settings = { id: crypto.randomUUID(), flow: inb.flow };
          stream = { security: inb.security, sni: inb.sni, fingerprint: inb.fingerprint, network: inb.transport };
          if (inb.security === 'reality') {
            stream.publicKey = inb.realityPublicKey;
            stream.shortId = inb.realityShortId;
            stream.spiderX = inb.realitySpiderX;
            stream.dest = inb.realityDest;
            stream.serverNames = [inb.sni];
          }
        } else if (inb.protocol === 'VMESS') {
          settings = { id: crypto.randomUUID() };
          stream = { security: inb.security, sni: inb.sni, fingerprint: inb.fingerprint, network: inb.transport };
        } else if (inb.protocol === 'TROJAN') {
          settings = { password };
          stream = { security: inb.security, sni: inb.sni, network: inb.transport };
        } else if (inb.protocol === 'SHADOWSOCKS') {
          settings = { method: 'aes-256-gcm', password };
        } else if (inb.protocol === 'HYSTERIA2') {
          settings = { password, sni: inb.sni };
        } else if (inb.protocol === 'NAIVEPROXY') {
          settings = { username: 'user', password, domain: inb.sni || '' };
        } else if (inb.protocol === 'MIERU') {
          settings = { username: 'user', password, transport: 'tcp' };
        } else if (inb.protocol === 'TUIC') {
          settings = { password, sni: inb.sni };
        }

        await inboundsApi.create({
          nodeId: node.data.id,
          protocol: inb.protocol as any,
          tag: inb.tag,
          port: inb.port,
          settings,
          stream,
          enable: true,
        });
      }
      return node;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); setCreated(true); },
  });

  const lc = "block text-[11px] font-bold text-fg-muted uppercase tracking-widest mb-1.5";

  if (created) {
    return (
      <Modal onClose={onClose} title={t('nodes.nodeCreated')} maxW="max-w-md">
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-700 flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <Check size={14} className="text-white" />
            </div>
            {t('nodes.nodeAdded')}
          </div>
          <div className="bg-bg-raised border border-border rounded-xl p-4 space-y-3 text-xs shadow-inner">
            <div className="flex justify-between"><span className="text-fg-subtle font-bold uppercase tracking-tighter">{t('nodes.hostLabel')}:</span> <span className="text-fg font-bold font-mono">{host}:{port}</span></div>
            <div className="flex justify-between"><span className="text-fg-subtle font-bold uppercase tracking-tighter">{t('nodes.apiPortLabel')}:</span> <span className="text-fg font-bold font-mono">{apiPort}</span></div>
            <div className="flex justify-between"><span className="text-fg-subtle font-bold uppercase tracking-tighter">{t('nodes.inboundsLabel')}:</span> <span className="text-fg font-bold">{inbounds.length}</span></div>
            <div className="flex justify-between"><span className="text-fg-subtle font-bold uppercase tracking-tighter">{t('nodes.portSharingLabel')}:</span> <span className="text-fg font-bold">{portShareEnabled ? 'ENABLED' : 'DISABLED'}</span></div>
          </div>
          <button onClick={onClose} className="w-full h-10 rounded-lg bg-zinc-900 text-white text-sm font-bold shadow-md hover:bg-zinc-800 transition-all active:scale-95">{t('nodes.done')}</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={t('nodes.addNode')} maxW="max-w-2xl">
      <TabBar tabs={['general', 'inbounds', 'advanced', 'portsharing']} active={tab} onChange={(v) => setTab(v as any)} />

      <div className="min-h-[320px]">
        {/* General */}
        {tab === 'general' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <Field label={`${t('nodes.nodeName')} *`} value={name} onChange={setName} placeholder="US-East-1" />
              <Field label={`${t('nodes.host')} *`} value={host} onChange={setHost} placeholder="1.2.3.4" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('nodes.port')} value={port} onChange={(v) => setPort(+v)} type="number" />
              <Field label={t('nodes.apiPort')} value={apiPort} onChange={(v) => setApiPort(+v)} type="number" />
            </div>
            <div className="space-y-1.5">
              <label className={lc}>{t('nodes.secret')} *</label>
              <div className="flex gap-2">
                <input 
                  className="flex-1 h-9 px-3 rounded-lg bg-bg-raised border border-border text-fg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg transition-all placeholder:text-fg-subtle" 
                  value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Worker NODE_RPC_SECRET" 
                />
                <button 
                  onClick={() => setSecret(crypto.randomUUID().replace(/-/g, ''))}
                  className="px-4 rounded-lg border border-border text-fg-muted hover:bg-bg-raised text-xs font-bold transition-all shrink-0"
                >
                  {t('nodes.gen')}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label={t('nodes.country')} value={country} onChange={setCountry} placeholder="US" />
              <Field label={t('nodes.city')} value={city} onChange={setCity} placeholder="New York" />
              <Field label={t('nodes.isp')} value={isp} onChange={setIsp} placeholder="AWS" />
            </div>
            <Field label={t('nodes.tagsPlaceholder')} value={tags} onChange={setTags} placeholder="premium, europe, fast" />
          </div>
        )}

        {/* Inbounds */}
        {tab === 'inbounds' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">{t('nodes.inboundConfigs', { count: String(inbounds.length) })}</span>
              <button 
                onClick={addInbound} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] font-bold hover:bg-zinc-800 shadow-md transition-all active:scale-95"
              >
                <PlusCircle size={14} /> {t('nodes.addInbound')}
              </button>
            </div>
            {inbounds.length === 0 ? (
              <div className="bg-bg-raised border border-border border-dashed rounded-xl p-12 text-center text-xs text-fg-subtle font-medium">
                {t('nodes.noInboundsConfigured')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {inbounds.map((inb, idx) => (
                  <InboundEditor key={idx} inb={inb} idx={idx} onUpdate={updateInbound} onRemove={removeInbound} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Advanced */}
        {tab === 'advanced' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="space-y-3">
              <h4 className={lc}>{t('nodes.security')}</h4>
              <div className="bg-bg-raised border border-border rounded-xl p-4 space-y-3 shadow-inner">
                <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('nodes.mtlsAuth')}</span><span className="text-emerald-600 font-bold uppercase">{t('nodes.enabledTokenBased')}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('nodes.rateLimiting')}</span><span className="text-fg font-bold">100 req/min</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('nodes.apiAccess')}</span><span className="text-fg font-bold">Token + IP Whitelist</span></div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className={lc}>{t('nodes.monitoring')}</h4>
              <div className="bg-bg-raised border border-border rounded-xl p-4 space-y-3 shadow-inner">
                <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('nodes.healthCheckInterval')}</span><span className="text-fg font-bold">30 seconds</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('nodes.metricsExport')}</span><span className="text-fg font-bold">WebSockets (v2)</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('nodes.trafficPolling')}</span><span className="text-fg font-bold">Real-time</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Port-Sharing */}
        {tab === 'portsharing' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="flex items-center justify-between bg-zinc-900 text-white rounded-xl p-5 shadow-lg shadow-fg-900/10 transition-all">
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-widest mb-1">{t('nodes.portSharing')}</div>
                <div className="text-[10px] text-fg-subtle font-medium leading-relaxed">{t('nodes.portSharingDesc')}</div>
              </div>
              <button 
                onClick={() => setPortShareEnabled(!portShareEnabled)}
                className={cn("relative w-11 h-6 rounded-full transition-all ring-2 ring-white/10", portShareEnabled ? "bg-emerald-500" : "bg-zinc-800")}
              >
                <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow-md transition-all", portShareEnabled ? "translate-x-5.5" : "translate-x-0.5")} />
              </button>
            </div>

            {portShareEnabled && (
              <div className="space-y-6 animate-in zoom-in-95 duration-200">
                <div className="space-y-3">
                  <label className={lc}>{t('nodes.multiplexor')}</label>
                  <div className="flex gap-3">
                    {[{ key: 'haproxy', label: t('nodes.haproxy') }, { key: 'nginx', label: t('nodes.nginx') }].map((m) => (
                      <button key={m.key} onClick={() => setMultiplexor(m.key as any)}
                        className={cn("flex-1 p-4 rounded-xl border text-center transition-all shadow-sm",
                          multiplexor === m.key ? "bg-zinc-900 border-fg text-white" : "bg-surface border-border text-fg-muted hover:border-border"
                        )}>
                        <div className="text-xs font-bold uppercase tracking-widest">{m.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Field label={t('nodes.sharedPort')} value={sharedPort} onChange={(v) => setSharedPort(+v)} type="number" />
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-amber-700 font-medium leading-relaxed">
                    {t('nodes.howItWorks')}: {multiplexor === 'haproxy' ? 'HAProxy' : 'Nginx'} {t('nodes.portSharingExplain')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-6 border-t border-border-subtle mt-8">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-fg-muted text-sm font-bold hover:bg-bg-raised transition-all">{t('common.cancel')}</button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!name || !host || !secret || mutation.isPending}
          className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-bold shadow-md hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> {t('nodes.creating')}</> : `${t('nodes.addNode')} (${inbounds.length})`}
        </button>
      </div>
    </Modal>
  );
}
