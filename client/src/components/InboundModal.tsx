import { useState, useCallback } from 'react';
import { X, Loader2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Inbound, inboundsApi } from '@/lib/api';

export type Protocol = 'VLESS' | 'VMESS' | 'TROJAN' | 'SHADOWSOCKS' | 'HYSTERIA2' | 'NAIVEPROXY' | 'MIERU' | 'TUIC';
export type Security = 'none' | 'tls' | 'reality';
export type Transport = 'tcp' | 'ws' | 'grpc' | 'httpupgrade' | 'xhttp' | 'h2' | 'kcp';
export type Fingerprint = 'chrome' | 'firefox' | 'safari' | 'edge' | 'random' | 'randomized' | 'hello' | 'zerossl';
export type Flow = '' | 'xtls-rprx-vision' | 'xtls-rprx-direct' | 'xtls-rprx-splice';

export interface InboundForm {
  id?: string; nodeId: string; protocol: Protocol; tag: string; port: number; listen: string;
  enable: boolean; remark: string; sniffing: boolean; security: Security;
  uuid: string; password: string; flow: Flow; method: string; alterId: number;
  transport: Transport; sni: string; fingerprint: Fingerprint; alpn: string; allowInsecure: boolean;
  minVersion: string; maxVersion: string;
  realityPublicKey: string; realityPrivateKey: string; realityShortId: string;
  realitySpiderX: string; realityDest: string; realityServerNames: string;
  wsPath: string; wsHost: string; wsMaxEarlyData: number; wsUseBrowserAgent: boolean;
  grpcServiceName: string; grpcMultiMode: boolean;
  h2Path: string; h2Host: string; h2Method: string;
  httpupgradePath: string; httpupgradeHost: string;
  xhttpPath: string; xhttpMode: string;
  kcpHeaderType: string; kcpSeed: string;
  certificates: string;
  sniffingDestOverride: string[]; sniffingMetadataOnly: boolean; sniffingRouteOnly: boolean;
  sniffingExcludedDomains: string; sniffingExcludedIPs: string;
  naiveProxy: string; naiveProto: string; naiveNonce: string;
  naivePadding: boolean; naivePaddingLength: number; naivePaddingMode: string;
  mieruAuth: string; mieruSessionPlacement: string; mieruSequencePlacement: string;
  mieruBufferReadSize: number; mieruBufferWriteSize: number;
  hy2ObfsType: string; hy2ObfsPassword: string; hy2BandwidthUp: string; hy2BandwidthDown: string;
  hy2MaxClient: number; hy2MaxStream: number;
  routingBlockTorrent: boolean; routingBlockAds: boolean;
  portShares: PortShareForm[];
}

export interface PortShareForm { id?: string; protocol: Protocol; tag: string; host: string; path: string; enable: boolean; }

const TABS = [
  { key: 'general', label: 'General' }, { key: 'transport', label: 'Transport' },
  { key: 'security', label: 'Security' }, { key: 'sniffing', label: 'Sniffing' },
  { key: 'advanced', label: 'Advanced JSON' }, { key: 'portshare', label: 'Port-Sharing' },
] as const;
type TabKey = typeof TABS[number]['key'];

// ── Themed style helpers ──
const S = {
  bg: 'var(--surface)', bgR: 'var(--bg-raised)', bgS: 'var(--bg-sunken)',
  fg: 'var(--fg)', fgM: 'var(--fg-muted)', fgS: 'var(--fg-subtle)',
  border: 'var(--border)', borderS: 'var(--border-subtle)',
  accent: 'var(--accent)', accentM: 'var(--accent-muted)',
  input: { background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--fg)' } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 500, color: 'var(--fg-muted)', marginBottom: 4 } as React.CSSProperties,
};

function Btn({ children, active, onClick, className }: { children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return <button onClick={onClick} className={cn("px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors", className)}
    style={{ background: active ? 'var(--accent-muted)' : 'transparent', color: active ? 'var(--accent)' : 'var(--fg-muted)', border: active ? '1px solid var(--accent)' : '1px solid var(--border)' }}>{children}</button>;
}

interface InboundModalProps { inbound?: Inbound; nodes: { id: string; name: string; host: string; status: string }[]; onClose: () => void; onSave: (data: InboundForm) => Promise<void>; }

export function InboundModal({ inbound, nodes, onClose, onSave }: InboundModalProps) {
  const [tab, setTab] = useState<TabKey>('general');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<InboundForm>(() => inbound ? inboundToForm(inbound) : defaultForm());
  const update = useCallback((key: keyof InboundForm, value: any) => setForm((f) => ({ ...f, [key]: value })), []);

  const applyPreset = useCallback(async (preset: Preset) => {
    const extraFields: Partial<InboundForm> = {};
    if (['VLESS', 'VMESS'].includes(preset.protocol)) {
      extraFields.uuid = crypto.randomUUID();
    }
    if (['TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC'].includes(preset.protocol)) {
      extraFields.password = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    }
    if (preset.fields.security === 'reality') {
      try {
        const { data } = await inboundsApi.generateRealityKeys();
        extraFields.realityPublicKey = data.publicKey;
        extraFields.realityPrivateKey = data.privateKey;
        extraFields.realityShortId = data.shortId;
      } catch (err) {
        console.error('Failed to generate Reality keys:', err);
      }
    }

    setForm((f) => {
      const cleanForm = defaultForm();
      cleanForm.nodeId = f.nodeId;
      if (f.id) {
        cleanForm.id = f.id;
        cleanForm.tag = f.tag;
      } else {
        const transportSuffix = preset.fields.transport ? `-${preset.fields.transport}` : '';
        const securitySuffix = preset.fields.security && preset.fields.security !== 'none' ? `-${preset.fields.security}` : '';
        cleanForm.tag = `${preset.protocol.toLowerCase()}${transportSuffix}${securitySuffix}`;
      }
      return {
        ...cleanForm,
        protocol: preset.protocol,
        ...preset.fields,
        ...extraFields,
      };
    });
  }, []);

  const handleSave = async () => { setSaving(true); try { await onSave(form); } finally { setSaving(false); } };
  const ti = TABS.findIndex((t) => t.key === tab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded" style={{ background: S.bg, border: `1px solid ${S.border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${S.borderS}` }}>
          <div className="flex items-center gap-3">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold border", protocolColor(form.protocol))}>{form.protocol}</span>
            <h2 className="text-sm font-semibold" style={{ color: S.fg }}>{inbound ? `Edit ${inbound.tag}` : 'Create Inbound'}</h2>
            {form.tag && <span className="text-[11px] font-mono" style={{ color: S.fgS }}>{form.tag}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ color: S.fgM }}><X size={16} /></button>
        </div>
        <div className="flex items-center gap-1 px-5 pt-2.5 shrink-0">
          {TABS.map((t, i) => <button key={t.key} onClick={() => setTab(t.key)} className="px-2.5 py-1.5 rounded text-[11px] font-medium"
            style={{ background: tab === t.key ? 'var(--accent-muted)' : 'transparent', color: tab === t.key ? 'var(--accent)' : 'var(--fg-muted)' }}>
            <span style={{ color: 'var(--fg-subtle)', marginRight: 4 }}>{i + 1}.</span>{t.label}</button>)}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {tab === 'general' && <TabGeneral form={form} update={update} nodes={nodes} applyPreset={applyPreset} />}
          {tab === 'transport' && <TabTransport form={form} update={update} />}
          {tab === 'security' && <TabSecurity form={form} update={update} />}
          {tab === 'sniffing' && <TabSniffing form={form} update={update} />}
          {tab === 'advanced' && <TabAdvancedJSON form={form} update={update} />}
          {tab === 'portshare' && <TabPortShare form={form} update={update} />}
        </div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderTop: `1px solid ${S.borderS}` }}>
          <div className="flex items-center gap-2">
            {ti > 0 && <button onClick={() => setTab(TABS[ti - 1].key)} className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium" style={{ background: S.bgR, color: S.fgM }}><ChevronLeft size={12} />{TABS[ti - 1].label}</button>}
            {ti < TABS.length - 1 && <button onClick={() => setTab(TABS[ti + 1].key)} className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium" style={{ background: S.bgR, color: S.fgM }}>{TABS[ti + 1].label}<ChevronRight size={12} /></button>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded text-[12px] font-medium" style={{ border: `1px solid ${S.border}`, color: S.fgM }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.tag || !form.nodeId} className="px-3 py-1.5 rounded text-[12px] font-semibold disabled:opacity-50 flex items-center gap-1.5" style={{ background: S.fg, color: 'var(--bg)' }}>
              {saving ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : inbound ? 'Save Changes' : 'Create Inbound'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: General ──
function TabGeneral({ form, update, nodes, applyPreset }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void; nodes: any[]; applyPreset: (preset: Preset) => void }) {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="space-y-4">
      <Sec title="Quick Setup Presets">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded text-[13px] font-medium transition-colors border"
            style={{
              background: 'var(--accent-muted)',
              color: 'var(--accent)',
              borderColor: 'var(--accent)'
            }}
          >
            <span className="flex items-center gap-2">
              <span>✨ Choose a Preset Configuration...</span>
            </span>
            <ChevronDown size={14} className={cn("transition-transform duration-200", showPresets && "rotate-180")} />
          </button>
          
          {showPresets && (
            <div
              className="absolute left-0 right-0 z-10 mt-1 rounded border shadow-lg max-h-60 overflow-y-auto"
              style={{
                background: S.bg,
                borderColor: S.border
              }}
            >
              <div className="p-1 space-y-0.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      applyPreset(p);
                      setShowPresets(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-raised)] transition-colors flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--fg)]">{p.name}</span>
                      <span className={cn("px-1.5 py-0.2 rounded text-[8px] font-semibold border uppercase", protocolColor(p.protocol))}>
                        {p.protocol}
                      </span>
                    </div>
                    {p.description && (
                      <span className="text-[10px] text-[var(--fg-muted)] line-clamp-1">{p.description}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sec>
      <Sec title="Target">
        <div><Lbl>Node *</Lbl><Sel value={form.nodeId} onChange={(v) => update('nodeId', v)} opts={[['', 'Select node...'], ...nodes.map((n) => [n.id, `${n.name} (${n.host}) — ${n.status}`] as [string, string])]} /></div>
      </Sec>
      <Sec title="Protocol">
        <div className="grid grid-cols-2 gap-3">
          <div><Lbl>Protocol *</Lbl><Sel value={form.protocol} onChange={(v) => { update('protocol', v); update('tag', `${v.toLowerCase()}-inbound`); }} opts={PROTOCOLS.map(p => [p, p])} /></div>
          <Fld label="Tag *" value={form.tag} onChange={(v) => update('tag', v)} placeholder="vless-inbound" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Port *" value={form.port} onChange={(v) => update('port', +v)} type="number" />
          <Fld label="Listen" value={form.listen} onChange={(v) => update('listen', v)} placeholder="0.0.0.0" />
        </div>
        <Fld label="Remark" value={form.remark} onChange={(v) => update('remark', v)} placeholder="Optional description" />
      </Sec>
      <Sec title="Protocol Settings">
        {['VLESS', 'VMESS'].includes(form.protocol) && <div className="grid grid-cols-2 gap-3">
          <div><Lbl>UUID *</Lbl><div className="flex gap-1.5"><Inp className="flex-1" value={form.uuid} onChange={(v) => update('uuid', v)} placeholder="Auto-generated" /><GenBtn onClick={() => update('uuid', crypto.randomUUID())} /></div></div>
          {form.protocol === 'VLESS' && <div><Lbl>Flow</Lbl><Sel value={form.flow} onChange={(v) => update('flow', v)} opts={FLOWS.map(f => [f, f || 'None (recommended)'])} /></div>}
          {form.protocol === 'VMESS' && <Fld label="AlterID" value={form.alterId} onChange={(v) => update('alterId', +v)} type="number" />}
        </div>}
        {['TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'MIERU'].includes(form.protocol) && <div><Lbl>Password *</Lbl><div className="flex gap-1.5"><Inp className="flex-1" value={form.password} onChange={(v) => update('password', v)} placeholder="Auto-generated" /><GenBtn onClick={() => update('password', crypto.randomUUID().replace(/-/g, '').substring(0, 16))} /></div></div>}
        {form.protocol === 'SHADOWSOCKS' && <div><Lbl>Method</Lbl><Sel value={form.method} onChange={(v) => update('method', v)} opts={SS_METHODS.map(m => [m, m])} /></div>}
        {form.protocol === 'HYSTERIA2' && <div className="grid grid-cols-2 gap-3"><Fld label="SNI" value={form.sni} onChange={(v) => update('sni', v)} placeholder="example.com" /><Fld label="Max Clients" value={form.hy2MaxClient} onChange={(v) => update('hy2MaxClient', +v)} type="number" /></div>}
        {form.protocol === 'NAIVEPROXY' && <div className="grid grid-cols-2 gap-3"><Fld label="Proxy URL" value={form.naiveProxy} onChange={(v) => update('naiveProxy', v)} placeholder="https://proxy.example.com" /><div><Lbl>Protocol</Lbl><Sel value={form.naiveProto} onChange={(v) => update('naiveProto', v)} opts={[['quic', 'QUIC'], ['tcp', 'TCP']]} /></div></div>}
        {form.protocol === 'MIERU' && <div><Lbl>Authentication</Lbl><Sel value={form.mieruAuth} onChange={(v) => update('mieruAuth', v)} opts={[['password', 'Password'], ['checksum', 'Checksum']]} /></div>}
      </Sec>
    </div>
  );
}

// ── Tab: Transport ──
function TabTransport({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  if (!['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol)) return <Empty msg={`${form.protocol} uses default transport settings`} />;
  return (
    <div className="space-y-4">
      <Sec title="Transport Layer">
        <div><Lbl>Network *</Lbl><div className="grid grid-cols-4 gap-1.5">{TRANSPORTS.map((t) => <Btn key={t} active={form.transport === t} onClick={() => update('transport', t)}>{t.toUpperCase()}</Btn>)}</div></div>
      </Sec>
      {form.transport === 'ws' && <Sec title="WebSocket Settings"><div className="grid grid-cols-2 gap-3"><Fld label="Path" value={form.wsPath} onChange={(v) => update('wsPath', v)} placeholder="/" /><Fld label="Host (optional)" value={form.wsHost} onChange={(v) => update('wsHost', v)} placeholder="example.com" /></div><div className="grid grid-cols-2 gap-3"><Fld label="Max Early Data" value={form.wsMaxEarlyData} onChange={(v) => update('wsMaxEarlyData', +v)} type="number" /><Tgl label="Browser Forwarding Agent" value={form.wsUseBrowserAgent} onChange={(v) => update('wsUseBrowserAgent', v)} /></div></Sec>}
      {form.transport === 'grpc' && <Sec title="gRPC Settings"><Fld label="Service Name" value={form.grpcServiceName} onChange={(v) => update('grpcServiceName', v)} placeholder="grpc-service" /><Tgl label="Multi-Mode" value={form.grpcMultiMode} onChange={(v) => update('grpcMultiMode', v)} /></Sec>}
      {form.transport === 'h2' && <Sec title="HTTP/2 Settings"><div className="grid grid-cols-2 gap-3"><Fld label="Path" value={form.h2Path} onChange={(v) => update('h2Path', v)} placeholder="/" /><Fld label="Host" value={form.h2Host} onChange={(v) => update('h2Host', v)} placeholder="example.com" /></div><Fld label="Method" value={form.h2Method} onChange={(v) => update('h2Method', v)} placeholder="PUT" /></Sec>}
      {form.transport === 'httpupgrade' && <Sec title="HTTPUpgrade Settings"><div className="grid grid-cols-2 gap-3"><Fld label="Path" value={form.httpupgradePath} onChange={(v) => update('httpupgradePath', v)} placeholder="/" /><Fld label="Host" value={form.httpupgradeHost} onChange={(v) => update('httpupgradeHost', v)} placeholder="example.com" /></div></Sec>}
      {form.transport === 'xhttp' && <Sec title="XHTTP Settings"><div className="grid grid-cols-2 gap-3"><Fld label="Path" value={form.xhttpPath} onChange={(v) => update('xhttpPath', v)} /><div><Lbl>Mode</Lbl><Sel value={form.xhttpMode} onChange={(v) => update('xhttpMode', v)} opts={[['auto', 'auto'], ['packet-up', 'packet-up'], ['stream-up', 'stream-up']]} /></div></div></Sec>}
      {form.transport === 'kcp' && <Sec title="mKCP Settings"><div className="grid grid-cols-2 gap-3"><div><Lbl>Header Type</Lbl><Sel value={form.kcpHeaderType} onChange={(v) => update('kcpHeaderType', v)} opts={KCP_HEADERS.map(h => [h, h])} /></div><Fld label="Seed" value={form.kcpSeed} onChange={(v) => update('kcpSeed', v)} placeholder="Optional seed" /></div></Sec>}
    </div>
  );
}

// ── Tab: Security ──
function TabSecurity({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  const [gen, setGen] = useState(false);
  if (!['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol)) return <Empty msg={`${form.protocol} uses default security`} />;
  const genKeys = async () => {
    setGen(true);
    try {
      const { data } = await inboundsApi.generateRealityKeys();
      update('realityPublicKey', data.publicKey);
      update('realityPrivateKey', data.privateKey);
      update('realityShortId', data.shortId);
    } catch (err) {
      console.error('Failed to generate Reality keys:', err);
    } finally {
      setGen(false);
    }
  };
  return (
    <div className="space-y-4">
      <Sec title="Security Protocol"><div><Lbl>Security *</Lbl><div className="grid grid-cols-3 gap-1.5">{SECURITY_OPTIONS.map((s) => <Btn key={s.value} active={form.security === s.value} onClick={() => update('security', s.value)}><div>{s.label}</div><div className="text-[9px] opacity-60 mt-0.5">{s.desc}</div></Btn>)}</div></div></Sec>
      {form.security === 'reality' && <Sec title="Reality Settings" accent>
        <button onClick={genKeys} disabled={gen} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium disabled:opacity-50" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>{gen ? <Loader2 size={12} className="animate-spin" /> : null}{gen ? 'Generating...' : 'Generate x25519 Key Pair + ShortId'}</button>
        <div className="grid grid-cols-2 gap-3"><Fld label="SNI *" value={form.sni} onChange={(v) => { update('sni', v); update('realityServerNames', v); }} placeholder="www.microsoft.com" /><div><Lbl>Fingerprint *</Lbl><Sel value={form.fingerprint} onChange={(v) => update('fingerprint', v)} opts={FINGERPRINTS.map(f => [f, f])} /></div></div>
        <div className="grid grid-cols-2 gap-3"><Fld label="Public Key *" value={form.realityPublicKey} onChange={(v) => update('realityPublicKey', v)} placeholder="x25519 public key" /><Fld label="Short ID *" value={form.realityShortId} onChange={(v) => update('realityShortId', v)} placeholder="hex string" /></div>
        <div className="grid grid-cols-2 gap-3"><Fld label="SpiderX" value={form.realitySpiderX} onChange={(v) => update('realitySpiderX', v)} placeholder="path obfuscation" /><Fld label="Dest" value={form.realityDest} onChange={(v) => update('realityDest', v)} placeholder="www.microsoft.com:443" /></div>
        <Fld label="Server Names (comma-separated)" value={form.realityServerNames} onChange={(v) => update('realityServerNames', v)} placeholder="www.microsoft.com" />
        {form.realityPrivateKey && <div className="p-3 rounded" style={{ background: 'var(--warning-muted)', border: '1px solid var(--warning)' }}><div className="text-[10px] font-medium mb-1" style={{ color: 'var(--warning)' }}>Private Key (save securely!)</div><code className="text-[11px] font-mono break-all" style={{ color: 'var(--fg)' }}>{form.realityPrivateKey}</code></div>}
      </Sec>}
      {form.security === 'tls' && <Sec title="TLS Settings" accent>
        <div className="grid grid-cols-2 gap-3"><Fld label="SNI" value={form.sni} onChange={(v) => update('sni', v)} placeholder="example.com" /><div><Lbl>Fingerprint</Lbl><Sel value={form.fingerprint} onChange={(v) => update('fingerprint', v)} opts={FINGERPRINTS.map(f => [f, f])} /></div></div>
        <div className="grid grid-cols-2 gap-3"><Fld label="ALPN" value={form.alpn} onChange={(v) => update('alpn', v)} placeholder="h2,http/1.1" /><Tgl label="Allow Insecure" value={form.allowInsecure} onChange={(v) => update('allowInsecure', v)} /></div>
        <div className="grid grid-cols-2 gap-3"><div><Lbl>Min TLS Version</Lbl><Sel value={form.minVersion} onChange={(v) => update('minVersion', v)} opts={TLS_VERSIONS.map(v => [v, v])} /></div><div><Lbl>Max TLS Version</Lbl><Sel value={form.maxVersion} onChange={(v) => update('maxVersion', v)} opts={TLS_VERSIONS.map(v => [v, v])} /></div></div>
        <Fld label="Custom Certificates (PEM)" value={form.certificates} onChange={(v) => update('certificates', v)} placeholder="Optional: paste cert+key PEM" />
      </Sec>}
      {form.security === 'none' && <Sec title="No Encryption" accent><div className="p-3 rounded text-[11px]" style={{ background: 'var(--warning-muted)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>No encryption will be applied. Traffic will be transmitted in plaintext.</div></Sec>}
    </div>
  );
}

// ── Tab: Sniffing ──
function TabSniffing({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  if (!['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol)) return <Empty msg={`${form.protocol} does not use sniffing`} />;
  const toggle = (d: string) => { const c = form.sniffingDestOverride || []; update('sniffingDestOverride', c.includes(d) ? c.filter(x => x !== d) : [...c, d]); };
  return (
    <div className="space-y-4">
      <Sec title="Protocol Detection">
        <Tgl label="Enable Sniffing" value={form.sniffing} onChange={(v) => update('sniffing', v)} />
        <div><Lbl>Dest Override</Lbl><div className="flex flex-wrap gap-1.5">{SNIFFING_DESTS.map((d) => <Btn key={d} active={form.sniffingDestOverride?.includes(d)} onClick={() => toggle(d)}>{d}</Btn>)}</div></div>
      </Sec>
      <Sec title="Options">
        <Tgl label="Metadata Only" value={form.sniffingMetadataOnly} onChange={(v) => update('sniffingMetadataOnly', v)} />
        <Tgl label="Route Only" value={form.sniffingRouteOnly} onChange={(v) => update('sniffingRouteOnly', v)} />
      </Sec>
      <Sec title="Exclusions">
        <TagInp label="Excluded Domains" value={form.sniffingExcludedDomains} onChange={(v) => update('sniffingExcludedDomains', v)} placeholder="*.example.com" />
        <TagInp label="Excluded IPs / CIDR" value={form.sniffingExcludedIPs} onChange={(v) => update('sniffingExcludedIPs', v)} placeholder="10.0.0.0/8" />
      </Sec>
    </div>
  );
}

// ── Tab: Advanced JSON ──
function TabAdvancedJSON({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  const [json, setJson] = useState(() => JSON.stringify(formToRawJson(form), null, 2));
  const [err, setErr] = useState('');
  const handleChange = (v: string) => { setJson(v); try { const p = JSON.parse(v); if (p.settings) Object.entries(p.settings).forEach(([k, val]) => update(k as any, val)); setErr(''); } catch { setErr('Invalid JSON'); } };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><span className="text-xs" style={{ color: S.fgM }}>Raw Inbound Configuration (JSON)</span><button onClick={() => { setJson(JSON.stringify(formToRawJson(form), null, 2)); setErr(''); }} className="px-2.5 py-1 rounded text-[11px] font-medium" style={{ border: `1px solid ${S.border}`, color: S.fgM }}>Sync from Form</button></div>
      {err && <div className="text-[11px] px-3 py-1.5 rounded" style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}>{err}</div>}
      <textarea value={json} onChange={(e) => handleChange(e.target.value)} className="w-full h-[400px] px-3 py-2 rounded font-mono text-[11px] focus:outline-none resize-none" style={{ ...S.input, border: err ? '1px solid var(--danger)' : `1px solid ${S.border}` }} spellCheck={false} />
    </div>
  );
}

// ── Tab: Port-Sharing ──
function TabPortShare({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  const add = () => update('portShares', [...(form.portShares || []), { protocol: 'VLESS' as Protocol, tag: `ps-${Date.now()}`, host: '', path: '', enable: true }]);
  const upd = (i: number, k: string, v: any) => { const s = [...(form.portShares || [])]; (s[i] as any)[k] = v; update('portShares', s); };
  const rm = (i: number) => update('portShares', (form.portShares || []).filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><span className="text-xs font-medium" style={{ color: S.fg }}>Port Shares <span style={{ color: S.fgS }}>({(form.portShares || []).length})</span></span><button onClick={add} className="px-2.5 py-1 rounded text-[11px] font-medium" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>+ Add</button></div>
      {(form.portShares || []).length === 0 ? <div className="p-8 rounded text-center text-xs" style={{ background: S.bgR, border: `1px solid ${S.borderS}`, color: S.fgS }}>No port shares. Add one to multiplex this inbound on the shared port.</div> : <div className="space-y-2">{(form.portShares || []).map((ps, i) => (
        <div key={i} className="p-3 rounded space-y-2" style={{ background: S.bgR, border: `1px solid ${S.border}` }}>
          <div className="flex items-center gap-2">
            <select className="w-28 px-2 py-1.5 rounded text-[11px]" style={S.input} value={ps.protocol} onChange={(e) => upd(i, 'protocol', e.target.value)}>{PROTOCOLS.map(p => <option key={p}>{p}</option>)}</select>
            <input className="flex-1 px-2 py-1.5 rounded text-[11px]" style={S.input} value={ps.tag} onChange={(e) => upd(i, 'tag', e.target.value)} placeholder="Tag" />
            <button onClick={() => rm(i)} className="p-1 rounded" style={{ color: S.fgS }}>×</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="px-2 py-1.5 rounded text-[11px]" style={S.input} value={ps.host} onChange={(e) => upd(i, 'host', e.target.value)} placeholder="SNI host" />
            <input className="px-2 py-1.5 rounded text-[11px]" style={S.input} value={ps.path} onChange={(e) => upd(i, 'path', e.target.value)} placeholder="Path (gRPC/WS)" />
          </div>
        </div>))}</div>}
    </div>
  );
}

// ── Shared primitives ──
function Sec({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2.5"><h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent ? 'var(--accent)' : 'var(--fg-subtle)' }}>{title}</h3><div className="space-y-2.5">{children}</div></div>;
}
function Lbl({ children }: { children: React.ReactNode }) { return <label style={S.label}>{children}</label>; }
function Fld({ label, value, onChange, type = 'text', placeholder }: { label: string; value: any; onChange: (v: any) => void; type?: string; placeholder?: string }) {
  return <div><Lbl>{label}</Lbl><Inp value={value} onChange={onChange} type={type} placeholder={placeholder} /></div>;
}
function Inp({ value, onChange, type = 'text', placeholder, className }: { value: any; onChange: (v: any) => void; type?: string; placeholder?: string; className?: string }) {
  return <input className={cn("w-full px-2.5 py-1.5 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]", className)} style={S.input} type={type} value={value} onChange={(e) => onChange(type === 'number' ? +e.target.value : e.target.value)} placeholder={placeholder} />;
}
function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return <select className="w-full px-2.5 py-1.5 rounded text-[13px] focus:outline-none" style={S.input} value={value} onChange={(e) => onChange(e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}
function Tgl({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <div className="flex items-center justify-between px-3 py-2.5 rounded" style={{ background: S.bgR, border: `1px solid ${S.borderS}` }}>
    <span className="text-xs" style={{ color: S.fg }}>{label}</span>
    <button onClick={() => onChange(!value)} className="relative w-9 h-5 rounded-full transition-colors" style={{ background: value ? 'var(--accent)' : 'var(--fg-subtle)' }}>
      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow-sm transition-transform" style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }} />
    </button>
  </div>;
}
function TagInp({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [inp, setInp] = useState('');
  const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];
  const add = () => { if (inp.trim() && !tags.includes(inp.trim())) { onChange([...tags, inp.trim()].join(', ')); setInp(''); } };
  const rm = (t: string) => onChange(tags.filter(x => x !== t).join(', '));
  return <div><Lbl>{label}</Lbl><div className="flex flex-wrap gap-1.5 mb-1.5">{tags.map(t => <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]" style={{ background: S.bgR, color: S.fgM }}>{t}<button onClick={() => rm(t)} style={{ color: S.fgS }}>×</button></span>)}</div><div className="flex gap-1.5"><Inp className="flex-1" value={inp} onChange={setInp} placeholder={placeholder} /><button onClick={add} className="px-2.5 rounded text-[11px]" style={{ border: `1px solid ${S.border}`, color: S.fgM }}>+</button></div></div>;
}
function GenBtn({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="px-2.5 rounded text-[11px] font-medium shrink-0" style={{ background: S.bgR, border: `1px solid ${S.border}`, color: S.fgM }}>Gen</button>; }
function Empty({ msg }: { msg: string }) { return <div className="text-center py-12 text-sm" style={{ color: S.fgS }}>{msg}</div>; }

// ── Constants ──
const PROTOCOLS: Protocol[] = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC'];
const TRANSPORTS: Transport[] = ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'h2', 'kcp'];
const SECURITY_OPTIONS = [{ value: 'none', label: 'None', desc: 'No encryption' }, { value: 'tls', label: 'TLS', desc: 'Standard TLS' }, { value: 'reality', label: 'Reality', desc: 'Anti-DPI' }];
const FINGERPRINTS: Fingerprint[] = ['chrome', 'firefox', 'safari', 'edge', 'random', 'randomized', 'hello', 'zerossl'];
const FLOWS: Flow[] = ['', 'xtls-rprx-vision', 'xtls-rprx-direct', 'xtls-rprx-splice'];
const TLS_VERSIONS = ['1.0', '1.1', '1.2', '1.3'];
const SS_METHODS = ['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305', '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305'];
const KCP_HEADERS = ['none', 'srtp', 'utp', 'wechat-video', 'dtls', 'wireguard'];
const SNIFFING_DESTS = ['http', 'tls', 'quic', 'stun', 'dns', 'bittorrent'];

export interface Preset {
  name: string;
  description: string;
  protocol: Protocol;
  fields: Partial<InboundForm>;
}

const PRESETS: Preset[] = [
  {
    name: 'VLESS + Reality + TCP (Vision)',
    description: 'Recommended VLESS config. High performance, secure, anti-DPI. Port 443.',
    protocol: 'VLESS',
    fields: {
      port: 443,
      security: 'reality',
      flow: 'xtls-rprx-vision',
      transport: 'tcp',
      sni: 'www.microsoft.com',
      realityDest: 'www.microsoft.com:443',
      realityServerNames: 'www.microsoft.com',
      fingerprint: 'chrome',
      sniffing: true,
      sniffingDestOverride: ['http', 'tls'],
    }
  },
  {
    name: 'VLESS + Reality + gRPC',
    description: 'Alternative VLESS config using gRPC transport. Useful for bypass / CDN setup. Port 443.',
    protocol: 'VLESS',
    fields: {
      port: 443,
      security: 'reality',
      flow: '',
      transport: 'grpc',
      grpcServiceName: 'grpc-reality',
      sni: 'www.microsoft.com',
      realityDest: 'www.microsoft.com:443',
      realityServerNames: 'www.microsoft.com',
      fingerprint: 'chrome',
      sniffing: true,
      sniffingDestOverride: ['http', 'tls'],
    }
  },
  {
    name: 'VLESS + WebSocket + TLS',
    description: 'VLESS over WebSocket with standard TLS encryption. Great for hosting behind CDN (Cloudflare). Port 443.',
    protocol: 'VLESS',
    fields: {
      port: 443,
      security: 'tls',
      flow: '',
      transport: 'ws',
      wsPath: '/graphql',
      sni: 'yourdomain.com',
      fingerprint: 'chrome',
      sniffing: true,
      sniffingDestOverride: ['http', 'tls'],
    }
  },
  {
    name: 'VLESS + TCP + TLS',
    description: 'Standard VLESS over TCP with standard TLS encryption. Needs a real domain & certificate. Port 443.',
    protocol: 'VLESS',
    fields: {
      port: 443,
      security: 'tls',
      flow: '',
      transport: 'tcp',
      sni: 'yourdomain.com',
      fingerprint: 'chrome',
      sniffing: true,
      sniffingDestOverride: ['http', 'tls'],
    }
  },
  {
    name: 'VMess + WebSocket + TLS',
    description: 'Classic VMess config behind CDN (Cloudflare) with WebSocket and TLS. Port 443.',
    protocol: 'VMESS',
    fields: {
      port: 443,
      security: 'tls',
      transport: 'ws',
      wsPath: '/vmess-ws',
      sni: 'yourdomain.com',
      fingerprint: 'chrome',
      sniffing: true,
      sniffingDestOverride: ['http', 'tls'],
    }
  },
  {
    name: 'VMess + gRPC + TLS',
    description: 'VMess config behind CDN using gRPC transport with TLS. Port 443.',
    protocol: 'VMESS',
    fields: {
      port: 443,
      security: 'tls',
      transport: 'grpc',
      grpcServiceName: 'vmess-grpc',
      sni: 'yourdomain.com',
      fingerprint: 'chrome',
      sniffing: true,
      sniffingDestOverride: ['http', 'tls'],
    }
  },
  {
    name: 'Trojan + TCP + TLS',
    description: 'Classic Trojan protocol over TCP with TLS. Secure, standard. Port 443.',
    protocol: 'TROJAN',
    fields: {
      port: 443,
      security: 'tls',
      transport: 'tcp',
      sni: 'yourdomain.com',
      sniffing: true,
      sniffingDestOverride: ['http', 'tls'],
    }
  },
  {
    name: 'Hysteria 2',
    description: 'Hysteria 2 protocol based on custom UDP/QUIC. High speed, bypasses congestion. Port 443 UDP.',
    protocol: 'HYSTERIA2',
    fields: {
      port: 443,
      sni: 'yourdomain.com',
    }
  },
  {
    name: 'Shadowsocks (2022-blake3-aes-128-gcm)',
    description: 'Shadowsocks using the modern 2022 standard. High performance and security.',
    protocol: 'SHADOWSOCKS',
    fields: {
      port: 8388,
      method: '2022-blake3-aes-128-gcm',
    }
  }
];

// ── Helpers ──
function protocolColor(p: string): string {
  const m: Record<string, string> = { VLESS: 'bg-blue-50 text-blue-600 border-blue-200', VMESS: 'bg-cyan-50 text-cyan-600 border-cyan-200', TROJAN: 'bg-rose-50 text-rose-600 border-rose-200', HYSTERIA2: 'bg-orange-50 text-orange-600 border-orange-200', NAIVEPROXY: 'bg-emerald-50 text-emerald-600 border-emerald-200', MIERU: 'bg-indigo-50 text-indigo-600 border-indigo-200', TUIC: 'bg-pink-50 text-pink-600 border-pink-200' };
  return m[p] || 'bg-bg-raised text-fg-muted border-border';
}
function defaultForm(): InboundForm {
  return { nodeId: '', protocol: 'VLESS', tag: 'vless-inbound', port: 443, listen: '0.0.0.0', enable: true, remark: '', sniffing: true, security: 'reality', uuid: '', password: '', flow: 'xtls-rprx-vision', method: 'aes-256-gcm', alterId: 0, transport: 'tcp', sni: 'www.microsoft.com', fingerprint: 'chrome', alpn: 'h2,http/1.1', allowInsecure: false, minVersion: '1.2', maxVersion: '1.3', realityPublicKey: '', realityPrivateKey: '', realityShortId: '', realitySpiderX: '', realityDest: 'www.microsoft.com:443', realityServerNames: 'www.microsoft.com', wsPath: '/', wsHost: '', wsMaxEarlyData: 0, wsUseBrowserAgent: false, grpcServiceName: '', grpcMultiMode: false, h2Path: '/', h2Host: '', h2Method: 'PUT', httpupgradePath: '/', httpupgradeHost: '', xhttpPath: '', xhttpMode: 'auto', kcpHeaderType: 'none', kcpSeed: '', certificates: '', sniffingDestOverride: ['http', 'tls'], sniffingMetadataOnly: false, sniffingRouteOnly: false, sniffingExcludedDomains: '', sniffingExcludedIPs: '', naiveProxy: '', naiveProto: 'quic', naiveNonce: '', naivePadding: true, naivePaddingLength: 512, naivePaddingMode: 'random', mieruAuth: 'password', mieruSessionPlacement: 'random', mieruSequencePlacement: 'random', mieruBufferReadSize: 16384, mieruBufferWriteSize: 16384, hy2ObfsType: 'none', hy2ObfsPassword: '', hy2BandwidthUp: '100 mbps', hy2BandwidthDown: '100 mbps', hy2MaxClient: 16, hy2MaxStream: 1024, routingBlockTorrent: false, routingBlockAds: false, portShares: [] };
}
function inboundToForm(ib: Inbound): InboundForm {
  const s = ib.settings as any, st = ib.stream as any, r = ib.routing as any, f = defaultForm();
  return {
    ...f,
    id: ib.id, nodeId: ib.nodeId, protocol: ib.protocol as Protocol, tag: ib.tag, port: ib.port, listen: ib.listen, enable: ib.enable, remark: ib.remark || '',
    sniffing: ib.sniffing,
    security: (st?.security || 'none') as Security,
    uuid: s?.id || '',
    password: s?.password || '',
    flow: s?.flow || '',
    method: s?.method || f.method,
    alterId: s?.alterId ?? 0,
    transport: (st?.network || 'tcp') as Transport,
    sni: st?.sni || '',
    fingerprint: st?.fingerprint || 'chrome',
    alpn: Array.isArray(st?.alpn) ? st.alpn.join(',') : (st?.alpn || ''),
    allowInsecure: st?.allowInsecure ?? false,
    minVersion: st?.minVersion || f.minVersion,
    maxVersion: st?.maxVersion || f.maxVersion,
    certificates: st?.certificates || '',
    realityPublicKey: st?.publicKey || '',
    realityPrivateKey: st?.privateKey || '',
    realityShortId: st?.shortId || '',
    realitySpiderX: st?.spiderX || '',
    realityDest: st?.dest || '',
    realityServerNames: st?.serverNames?.join(', ') || st?.sni || '',
    wsPath: st?.wsSettings?.path || st?.path || '/',
    wsHost: st?.wsSettings?.host || st?.host || '',
    wsMaxEarlyData: st?.wsSettings?.maxEarlyData ?? 0,
    grpcServiceName: st?.grpcSettings?.serviceName || '',
    grpcMultiMode: st?.grpcSettings?.multiMode ?? false,
    h2Path: st?.httpSettings?.path || '/',
    h2Host: Array.isArray(st?.httpSettings?.host) ? st.httpSettings.host[0] : (st?.httpSettings?.host || ''),
    h2Method: st?.httpSettings?.method || 'PUT',
    httpupgradePath: st?.httpupgradeSettings?.path || '/',
    httpupgradeHost: st?.httpupgradeSettings?.host || '',
    xhttpPath: st?.xhttpSettings?.path || '',
    xhttpMode: st?.xhttpSettings?.mode || 'auto',
    kcpHeaderType: st?.kcpSettings?.header?.type || 'none',
    kcpSeed: st?.kcpSettings?.seed || '',
    routingBlockTorrent: r?.blockTorrent ?? false,
    routingBlockAds: r?.blockAds ?? false,
  };
}
function formToRawJson(f: InboundForm): any {
  const isXray = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(f.protocol);
  const result: any = { protocol: f.protocol, tag: f.tag, port: f.port, listen: f.listen, enable: f.enable };

  if (f.protocol === 'VLESS') {
    result.settings = { id: f.uuid, flow: f.flow };
    result.stream = { security: f.security || 'none', network: f.transport, sni: f.sni, fingerprint: f.fingerprint };
    if (f.security === 'reality') {
      result.stream.publicKey = f.realityPublicKey;
      result.stream.shortId = f.realityShortId;
      result.stream.spiderX = f.realitySpiderX;
      result.stream.dest = f.realityDest;
    }
  } else if (f.protocol === 'VMESS') {
    result.settings = { id: f.uuid, alterId: f.alterId };
    result.stream = { security: f.security || 'none', network: f.transport, sni: f.sni, fingerprint: f.fingerprint };
  } else if (f.protocol === 'TROJAN') {
    result.settings = { password: f.password };
    result.stream = { security: f.security || 'none', network: f.transport, sni: f.sni };
  } else if (f.protocol === 'SHADOWSOCKS') {
    result.settings = { method: f.method, password: f.password };
  } else if (f.protocol === 'HYSTERIA2') {
    result.settings = { password: f.password, sni: f.sni };
  } else if (f.protocol === 'NAIVEPROXY') {
    result.settings = { username: 'user', password: f.password, domain: f.sni || '' };
    result.tls = { server_name: f.sni || '' };
  } else if (f.protocol === 'MIERU') {
    result.settings = { username: 'user', password: f.password, transport: 'tcp', multiplexing: 'MULTIPLEXING_HIGH' };
  } else if (f.protocol === 'TUIC') {
    result.settings = { password: f.password, sni: f.sni };
  } else {
    result.settings = { password: f.password };
  }

  if (isXray) {
    result.sniffing = { enabled: f.sniffing, destOverride: f.sniffingDestOverride };
  }

  return result;
}
