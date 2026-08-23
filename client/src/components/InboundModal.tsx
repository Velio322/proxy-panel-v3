import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ChevronLeft, ChevronRight, KeyRound, Sparkles } from 'lucide-react';
import { Inbound } from '@/lib/api';
import { generateUUID, generatePassword } from '@/lib/utils';

export type Protocol = 'VLESS' | 'VMESS' | 'TROJAN' | 'SHADOWSOCKS' | 'HYSTERIA2' | 'NAIVEPROXY' | 'MIERU' | 'TUIC';
export type Security = 'none' | 'tls' | 'reality';
export type Transport = 'tcp' | 'ws' | 'grpc' | 'httpupgrade' | 'xhttp' | 'h2' | 'kcp';
export type Fingerprint = 'chrome' | 'firefox' | 'safari' | 'edge' | 'random' | 'randomized' | 'hello' | 'zerossl';
export type Flow = '' | 'xtls-rprx-vision' | 'xtls-rprx-direct' | 'xtls-rprx-splice';

export interface InboundForm {
  id?: string;
  nodeId: string;
  protocol: Protocol;
  tag: string;
  port: number;
  listen: string;
  enable: boolean;
  remark: string;
  sniffing: boolean;
  security: Security;
  uuid: string;
  password: string;
  flow: Flow;
  method: string;
  alterId: number;
  transport: Transport;
  sni: string;
  fingerprint: Fingerprint;
  alpn: string;
  allowInsecure: boolean;
  minVersion: string;
  maxVersion: string;
  realityPublicKey: string;
  realityPrivateKey: string;
  realityShortId: string;
  realitySpiderX: string;
  realityDest: string;
  realityServerNames: string;
  wsPath: string;
  wsHost: string;
  wsMaxEarlyData: number;
  wsUseBrowserAgent: boolean;
  grpcServiceName: string;
  grpcMultiMode: boolean;
  h2Path: string;
  h2Host: string;
  h2Method: string;
  httpupgradePath: string;
  httpupgradeHost: string;
  xhttpPath: string;
  xhttpMode: string;
  kcpHeaderType: string;
  kcpSeed: string;
  certificates: string;
  sniffingDestOverride: string[];
  sniffingMetadataOnly: boolean;
  sniffingRouteOnly: boolean;
  sniffingExcludedDomains: string;
  sniffingExcludedIPs: string;
  // NaiveProxy parameters
  naiveDomain: string;
  naiveEmail: string;
  naiveTlsMode: 'letsencrypt' | 'custom' | 'acme';
  naiveCertFile: string;
  naiveKeyFile: string;
  naiveFallbackRoot: string;
  naiveWarpUpstream: string;
  naiveHideIp: boolean;
  naiveHideVia: boolean;
  naiveProbeResistance: boolean;
  // Mieru parameters
  mieruTransport: 'tcp' | 'udp' | 'both';
  mieruLoggingLevel: string;
  mieruPortRange: string;
  // Hysteria 2 parameters
  hy2ObfsType: string;
  hy2ObfsPassword: string;
  hy2BandwidthUp: string;
  hy2BandwidthDown: string;
  hy2MaxClient: number;
  hy2MaxStream: number;
  routingBlockTorrent: boolean;
  routingBlockAds: boolean;
  portShares: PortShareForm[];
}

export interface PortShareForm {
  id?: string;
  protocol: Protocol;
  tag: string;
  host: string;
  path: string;
  enable: boolean;
}

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'transport', label: 'Transport' },
  { key: 'security', label: 'Security & TLS' },
  { key: 'sniffing', label: 'Sniffing' },
  { key: 'advanced', label: 'JSON Config' },
  { key: 'portshare', label: 'Port Sharing' },
] as const;
type TabKey = typeof TABS[number]['key'];

const PROTOCOLS: Protocol[] = ['VLESS', 'HYSTERIA2', 'TROJAN', 'SHADOWSOCKS', 'NAIVEPROXY', 'MIERU', 'VMESS', 'TUIC'];
const TRANSPORTS: Transport[] = ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'h2', 'kcp'];
const FINGERPRINTS: Fingerprint[] = ['chrome', 'firefox', 'safari', 'edge', 'random', 'randomized', 'hello', 'zerossl'];
const FLOWS: Flow[] = ['', 'xtls-rprx-vision', 'xtls-rprx-direct', 'xtls-rprx-splice'];
const SS_METHODS = ['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305', '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305'];
const SNIFFING_DESTS = ['http', 'tls', 'quic', 'stun', 'dns', 'bittorrent'];

interface InboundModalProps {
  inbound?: Inbound;
  nodes: { id: string; name: string; host: string; status: string }[];
  onClose: () => void;
  onSave: (data: InboundForm) => Promise<void>;
}

export function InboundModal({ inbound, nodes = [], onClose, onSave }: InboundModalProps) {
  const [tab, setTab] = useState<TabKey>('general');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<InboundForm>(() => (inbound ? inboundToForm(inbound) : defaultForm()));

  const update = useCallback((key: keyof InboundForm, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const ti = TABS.findIndex((t) => t.key === tab);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-bg-raised/40">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono tracking-wider bg-accent/15 text-accent border border-accent/30">
              {form.protocol}
            </span>
            <div>
              <h2 className="text-base font-bold text-fg">
                {inbound ? `Edit Inbound: ${inbound.tag}` : 'Create Inbound Port'}
              </h2>
              <p className="text-xs text-fg-subtle">Configure proxy protocol, transport, encryption, and routing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 pt-3 border-b border-border/50 bg-bg-sunken/30 overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-semibold transition-all flex items-center gap-1.5 border-b-2 ${
                tab === t.key
                  ? 'border-accent text-accent bg-surface shadow-sm'
                  : 'border-transparent text-fg-muted hover:text-fg hover:bg-surface-hover/50'
              }`}
            >
              <span className="text-[10px] text-fg-subtle">{i + 1}.</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-bg/30">
          {tab === 'general' && <TabGeneral form={form} update={update} nodes={nodes} />}
          {tab === 'transport' && <TabTransport form={form} update={update} />}
          {tab === 'security' && <TabSecurity form={form} update={update} />}
          {tab === 'sniffing' && <TabSniffing form={form} update={update} />}
          {tab === 'advanced' && <TabAdvancedJSON form={form} />}
          {tab === 'portshare' && <TabPortShare form={form} update={update} />}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/80 bg-bg-raised/40">
          <div className="flex items-center gap-2">
            {ti > 0 && (
              <button
                onClick={() => setTab(TABS[ti - 1].key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-fg-muted hover:text-fg bg-surface border border-border hover:bg-surface-hover transition-colors"
              >
                <ChevronLeft size={14} />
                {TABS[ti - 1].label}
              </button>
            )}
            {ti < TABS.length - 1 && (
              <button
                onClick={() => setTab(TABS[ti + 1].key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-fg-muted hover:text-fg bg-surface border border-border hover:bg-surface-hover transition-colors"
              >
                {TABS[ti + 1].label}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.tag || !form.nodeId}
              className="btn-primary px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {saving ? 'Saving...' : inbound ? 'Save Changes' : 'Create Inbound'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
// Tab: General
function TabGeneral({ form, update, nodes }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void; nodes: any[] }) {
  return (
    <div className="space-y-6">
      {/* Node Selection */}
      <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">1. Target Node</h3>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1.5">Select Node *</label>
          <select
            className="input-base"
            value={form.nodeId}
            onChange={(e) => update('nodeId', e.target.value)}
          >
            <option value="">-- Choose target node --</option>
            {(nodes || []).map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.host}) — [{n.status}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Protocol & Basic Info */}
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">2. Inbound Identification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Protocol *</label>
            <select
              className="input-base font-semibold text-accent"
              value={form.protocol}
              onChange={(e) => {
                const proto = e.target.value as Protocol;
                update('protocol', proto);
                update('tag', `${proto.toLowerCase()}-inbound`);
              }}
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Tag (Identifier) *</label>
            <input
              type="text"
              className="input-base font-mono"
              value={form.tag}
              onChange={(e) => update('tag', e.target.value)}
              placeholder="e.g. vless-reality-443"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Port *</label>
            <input
              type="number"
              className="input-base font-mono"
              value={form.port}
              onChange={(e) => update('port', parseInt(e.target.value) || 443)}
              min={1}
              max={65535}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Listen Address</label>
            <input
              type="text"
              className="input-base font-mono"
              value={form.listen}
              onChange={(e) => update('listen', e.target.value)}
              placeholder="0.0.0.0"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1.5">Remark (Optional note)</label>
          <input
            type="text"
            className="input-base"
            value={form.remark}
            onChange={(e) => update('remark', e.target.value)}
            placeholder="Main production entrypoint..."
          />
        </div>
      </div>

      {/* Protocol Specific Primary Settings */}
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">3. Credentials & Core Parameters</h3>

        {['VLESS', 'VMESS'].includes(form.protocol) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">UUID *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-base font-mono text-xs flex-1"
                  value={form.uuid}
                  onChange={(e) => update('uuid', e.target.value)}
                  placeholder="Auto-generated UUID"
                />
                <button
                  type="button"
                  onClick={() => update('uuid', generateUUID())}
                  className="px-3 py-2 rounded-xl bg-bg-raised border border-border text-xs font-bold text-fg-muted hover:text-fg hover:border-accent"
                >
                  Gen
                </button>
              </div>
            </div>
            {form.protocol === 'VLESS' && (
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Flow (XTLS-Vision)</label>
                <select className="input-base" value={form.flow} onChange={(e) => update('flow', e.target.value as Flow)}>
                  {FLOWS.map((f) => (
                    <option key={f} value={f}>
                      {f || 'None (Standard)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {['TROJAN', 'SHADOWSOCKS', 'HYSTERIA2'].includes(form.protocol) && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Password / Secret *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-base font-mono text-xs flex-1"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Security password"
                />
                <button
                  type="button"
                  onClick={() => update('password', generatePassword(16))}
                  className="px-3 py-2 rounded-xl bg-bg-raised border border-border text-xs font-bold text-fg-muted hover:text-fg hover:border-accent"
                >
                  Gen
                </button>
              </div>
            </div>

            {form.protocol === 'SHADOWSOCKS' && (
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Encryption Method</label>
                <select className="input-base" value={form.method} onChange={(e) => update('method', e.target.value)}>
                  {SS_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.protocol === 'HYSTERIA2' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5">Bandwidth Up/Down</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input-base font-mono text-xs"
                      value={form.hy2BandwidthUp}
                      onChange={(e) => update('hy2BandwidthUp', e.target.value)}
                      placeholder="100 mbps"
                    />
                    <input
                      type="text"
                      className="input-base font-mono text-xs"
                      value={form.hy2BandwidthDown}
                      onChange={(e) => update('hy2BandwidthDown', e.target.value)}
                      placeholder="100 mbps"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1.5">Obfuscation Type</label>
                  <select className="input-base" value={form.hy2ObfsType} onChange={(e) => update('hy2ObfsType', e.target.value)}>
                    <option value="none">None</option>
                    <option value="salamander">Salamander (Recommended)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NaiveProxy Settings */}
        {form.protocol === 'NAIVEPROXY' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Domain / SNI *</label>
                <input
                  type="text"
                  className="input-base font-mono text-xs"
                  value={form.sni}
                  onChange={(e) => update('sni', e.target.value)}
                  placeholder="proxy.example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">TLS Certificate Mode</label>
                <select
                  className="input-base"
                  value={form.naiveTlsMode}
                  onChange={(e) => update('naiveTlsMode', e.target.value as any)}
                >
                  <option value="letsencrypt">Let's Encrypt (Automatic ACME)</option>
                  <option value="custom">Custom Cert / Key Files</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Camouflage / Fallback Root</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.naiveFallbackRoot}
                onChange={(e) => update('naiveFallbackRoot', e.target.value)}
                placeholder="/var/www/html"
              />
            </div>
          </div>
        )}

        {/* Mieru Settings */}
        {form.protocol === 'MIERU' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Transport Mode</label>
                <select
                  className="input-base font-semibold"
                  value={form.mieruTransport}
                  onChange={(e) => update('mieruTransport', e.target.value as any)}
                >
                  <option value="both">Both (TCP & UDP Dual Binding)</option>
                  <option value="tcp">TCP Only</option>
                  <option value="udp">UDP Only</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Logging Level</label>
                <select
                  className="input-base"
                  value={form.mieruLoggingLevel}
                  onChange={(e) => update('mieruLoggingLevel', e.target.value)}
                >
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// Tab: Transport
function TabTransport({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  if (!['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol)) {
    return (
      <div className="p-12 text-center rounded-2xl bg-surface border border-border text-fg-subtle text-xs">
        {form.protocol} utilizes native protocol transport layer configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Transport Protocol</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRANSPORTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update('transport', t)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                form.transport === t
                  ? 'bg-accent text-white shadow-md shadow-accent/25 border border-accent'
                  : 'bg-bg-raised text-fg-muted border border-border hover:border-fg-subtle'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {form.transport === 'ws' && (
        <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">WebSocket Parameters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">WS Path</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.wsPath}
                onChange={(e) => update('wsPath', e.target.value)}
                placeholder="/ws"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">WS Host</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.wsHost}
                onChange={(e) => update('wsHost', e.target.value)}
                placeholder="example.com"
              />
            </div>
          </div>
        </div>
      )}

      {form.transport === 'grpc' && (
        <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">gRPC Parameters</h3>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Service Name</label>
            <input
              type="text"
              className="input-base font-mono text-xs"
              value={form.grpcServiceName}
              onChange={(e) => update('grpcServiceName', e.target.value)}
              placeholder="grpc-service"
            />
          </div>
        </div>
      )}

      {form.transport === 'xhttp' && (
        <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">XHTTP Parameters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">XHTTP Path</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.xhttpPath}
                onChange={(e) => update('xhttpPath', e.target.value)}
                placeholder="/xhttp"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">XHTTP Mode</label>
              <select className="input-base" value={form.xhttpMode} onChange={(e) => update('xhttpMode', e.target.value)}>
                <option value="auto">auto</option>
                <option value="packet-up">packet-up</option>
                <option value="stream-up">stream-up</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Tab: Security
function TabSecurity({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  const generateRealityKeys = () => {
    const pk = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const priv = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const sid = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    update('realityPublicKey', pk);
    update('realityPrivateKey', priv);
    update('realityShortId', sid);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Security & Encryption Layer</h3>
        <div className="grid grid-cols-3 gap-3">
          {(['reality', 'tls', 'none'] as Security[]).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => update('security', sec)}
              className={`p-3.5 rounded-xl text-left border transition-all ${
                form.security === sec
                  ? 'bg-accent/10 border-accent text-accent shadow-sm'
                  : 'bg-bg-raised border-border text-fg-muted hover:border-fg-subtle'
              }`}
            >
              <div className="text-xs font-bold uppercase">{sec}</div>
              <div className="text-[10px] text-fg-subtle mt-0.5">
                {sec === 'reality' ? 'Anti-DPI (Camouflage)' : sec === 'tls' ? 'Standard TLS Certificate' : 'Plaintext'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {form.security === 'reality' && (
        <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent">Reality Anti-DPI Settings</h3>
            <button
              type="button"
              onClick={generateRealityKeys}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-muted text-accent border border-accent/30 text-xs font-bold hover:bg-accent hover:text-white transition-all shadow-sm"
            >
              <KeyRound size={13} /> Generate Keypair
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">SNI (Target Server Name) *</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.sni}
                onChange={(e) => {
                  update('sni', e.target.value);
                  update('realityServerNames', e.target.value);
                }}
                placeholder="www.microsoft.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Client Fingerprint</label>
              <select
                className="input-base"
                value={form.fingerprint}
                onChange={(e) => update('fingerprint', e.target.value as Fingerprint)}
              >
                {FINGERPRINTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Public Key *</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.realityPublicKey}
                onChange={(e) => update('realityPublicKey', e.target.value)}
                placeholder="x25519 public key"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Short ID *</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.realityShortId}
                onChange={(e) => update('realityShortId', e.target.value)}
                placeholder="e.g. 0123456789abcdef"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Dest (Target Handshake Server)</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.realityDest}
                onChange={(e) => update('realityDest', e.target.value)}
                placeholder="www.microsoft.com:443"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">SpiderX Path</label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                value={form.realitySpiderX}
                onChange={(e) => update('realitySpiderX', e.target.value)}
                placeholder="/"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Tab: Sniffing
function TabSniffing({ form, update }: { form: InboundForm; update: (k: keyof InboundForm, v: any) => void }) {
  const toggleDest = (d: string) => {
    const current = form.sniffingDestOverride || [];
    update('sniffingDestOverride', current.includes(d) ? current.filter((x) => x !== d) : [...current, d]);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-fg">Traffic Sniffing</h3>
            <p className="text-xs text-fg-subtle">Inspect domain and protocol for granular routing</p>
          </div>
          <button
            type="button"
            onClick={() => update('sniffing', !form.sniffing)}
            className={`w-11 h-6 rounded-full transition-colors relative ${form.sniffing ? 'bg-accent' : 'bg-bg-sunken border border-border'}`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                form.sniffing ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {form.sniffing && (
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-2">Protocol Interception</label>
            <div className="flex flex-wrap gap-2">
              {SNIFFING_DESTS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDest(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    form.sniffingDestOverride?.includes(d)
                      ? 'bg-accent/20 border border-accent text-accent'
                      : 'bg-bg-raised border border-border text-fg-muted hover:border-fg-subtle'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// Tab: Advanced JSON
function TabAdvancedJSON({ form }: { form: InboundForm }) {
  const jsonStr = JSON.stringify(form, null, 2);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Inbound Form State (JSON)</h3>
      </div>
      <pre className="p-4 rounded-xl bg-bg-sunken border border-border text-xs font-mono text-fg-muted overflow-x-auto max-h-[350px]">
        {jsonStr}
      </pre>
    </div>
  );
}
// Tab: Port Sharing
    alpn: 'h2,http/1.1',
    allowInsecure: false,
    minVersion: '1.2',
    maxVersion: '1.3',
    realityPublicKey: '',
    realityPrivateKey: '',
    realityShortId: '0123456789abcdef',
    realitySpiderX: '/',
    realityDest: 'www.microsoft.com:443',
    realityServerNames: 'www.microsoft.com',
    wsPath: '/',
    wsHost: '',
    wsMaxEarlyData: 0,
    wsUseBrowserAgent: false,
    grpcServiceName: '',
    grpcMultiMode: false,
    h2Path: '/',
    h2Host: '',
    h2Method: 'PUT',
    httpupgradePath: '/',
    httpupgradeHost: '',
    xhttpPath: '',
    xhttpMode: 'auto',
    kcpHeaderType: 'none',
    kcpSeed: '',
    certificates: '',
    sniffingDestOverride: ['http', 'tls'],
    sniffingMetadataOnly: false,
    sniffingRouteOnly: false,
    sniffingExcludedDomains: '',
    sniffingExcludedIPs: '',
    naiveDomain: '',
    naiveEmail: '',
    naiveTlsMode: 'letsencrypt',
    naiveCertFile: '',
    naiveKeyFile: '',
    naiveFallbackRoot: '/var/www/html',
    naiveWarpUpstream: '',
    naiveHideIp: true,
    naiveHideVia: true,
    naiveProbeResistance: true,
    mieruTransport: 'both',
    mieruLoggingLevel: 'INFO',
    mieruPortRange: '',
    hy2ObfsType: 'none',
    hy2ObfsPassword: '',
    hy2BandwidthUp: '100 mbps',
    hy2BandwidthDown: '100 mbps',
    hy2MaxClient: 16,
    hy2MaxStream: 1024,
    routingBlockTorrent: false,
    routingBlockAds: false,
    portShares: [],
  };
}

function inboundToForm(ib: Inbound): InboundForm {
  const s = (ib.settings as any) || {};
  const st = (ib.stream as any) || {};
  const r = (ib.routing as any) || {};
  const f = defaultForm();

  return {
    ...f,
    id: ib.id,
    nodeId: ib.nodeId,
    protocol: ib.protocol as Protocol,
    tag: ib.tag,
    port: ib.port,
    listen: ib.listen || '0.0.0.0',
    enable: ib.enable,
    remark: ib.remark || '',
    sniffing: ib.sniffing,
    security: (st?.security || 'none') as Security,
    uuid: s?.id || f.uuid,
    password: s?.password || f.password,
    flow: s?.flow || '',
    method: s?.method || f.method,
    alterId: s?.alterId ?? 0,
    transport: (st?.network || 'tcp') as Transport,
    sni: st?.sni || s?.domain || '',
    fingerprint: st?.fingerprint || 'chrome',
    alpn: Array.isArray(st?.alpn) ? st.alpn.join(',') : st?.alpn || '',
    allowInsecure: st?.allowInsecure ?? false,
    realityPublicKey: st?.publicKey || '',
    realityPrivateKey: st?.privateKey || '',
    realityShortId: st?.shortId || '',
    realitySpiderX: st?.spiderX || '',
    realityDest: st?.dest || '',
    realityServerNames: st?.serverNames?.join(', ') || st?.sni || '',
    wsPath: st?.wsSettings?.path || st?.path || '/',
    wsHost: st?.wsSettings?.host || st?.host || '',
    grpcServiceName: st?.grpcSettings?.serviceName || '',
    xhttpPath: st?.xhttpSettings?.path || '',
    xhttpMode: st?.xhttpSettings?.mode || 'auto',
    routingBlockTorrent: r?.blockTorrent ?? false,
    routingBlockAds: r?.blockAds ?? false,
  };
}
