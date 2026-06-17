import { cn } from '@/lib/utils';

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

const PROTOCOLS = [
  { value: 'VLESS', desc: 'Xray-core, Reality/TLS', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { value: 'VMESS', desc: 'Xray-core, legacy support', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { value: 'TROJAN', desc: 'TLS-based, Trojan protocol', color: 'text-red-400', bg: 'bg-red-500/10' },
  { value: 'SHADOWSOCKS', desc: 'Classic SOCKS5 proxy', color: 'text-fg-muted', bg: 'bg-fg-subtle/10' },
  { value: 'HYSTERIA2', desc: 'UDP-based, high performance', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { value: 'NAIVEPROXY', desc: 'Chrome network stack', color: 'text-green-400', bg: 'bg-green-500/10' },
  { value: 'MIERU', desc: 'UDP-based, anti-censorship', color: 'text-[hsl(var(--accent))]', bg: 'bg-purple-500/10' },
  { value: 'TUIC', desc: 'UDP-based, QUIC native', color: 'text-pink-400', bg: 'bg-pink-500/10' },
];

const SS_METHODS = [
  'aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305',
];

const HY2_OBFS_TYPES = ['none', 'salamander', 'xplus'];

interface GeneralTabProps {
  form: Record<string, any>;
  update: (key: string, value: any) => void;
  nodes: { id: string; name: string; host: string; status: string }[];
}

export function TabGeneral({ form, update, nodes }: GeneralTabProps) {
  return (
    <div className="space-y-5">
      {/* ──── Target Node ──── */}
      <Section title="Target Node">
        <div>
          <label className={labelCls}>Node *</label>
          <select className={inputCls} value={form.nodeId} onChange={(e) => update('nodeId', e.target.value)}>
            <option value="">Select node...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.host}) — {n.status}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* ──── Protocol Selection ──── */}
      <Section title="Protocol">
        <div className="grid grid-cols-4 gap-2">
          {PROTOCOLS.map((p) => (
            <button key={p.value} onClick={() => {
              update('protocol', p.value);
              if (!form.tag || form.tag.endsWith('-inbound')) {
                update('tag', `${p.value.toLowerCase()}-inbound`);
              }
            }}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-3 rounded-xl border transition-all",
                form.protocol === p.value
                  ? "border-[hsl(var(--accent/0.3))] bg-purple-500/10 ring-1 ring-purple-500/20"
                  : "border-border hover:border-border"
              )}>
              <span className={cn("text-[11px] font-bold", form.protocol === p.value ? "text-white" : p.color)}>
                {p.value}
              </span>
              <span className="text-[9px] text-fg-subtle text-center leading-tight">{p.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ──── Network Settings ──── */}
      <Section title="Network">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tag *</label>
            <input className={inputCls} value={form.tag}
              onChange={(e) => update('tag', e.target.value)}
              placeholder="vless-inbound" />
          </div>
          <div>
            <label className={labelCls}>Port *</label>
            <input className={inputCls} type="number" value={form.port}
              onChange={(e) => update('port', +e.target.value)}
              min={1} max={65535} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Listen Address</label>
            <input className={inputCls} value={form.listen || '0.0.0.0'}
              onChange={(e) => update('listen', e.target.value)}
              placeholder="0.0.0.0" />
          </div>
          <div>
            <label className={labelCls}>Remark</label>
            <input className={inputCls} value={form.remark || ''}
              onChange={(e) => update('remark', e.target.value)}
              placeholder="Optional description" />
          </div>
        </div>
      </Section>

      {/* ──── Protocol-Specific Settings ──── */}
      <Section title="Protocol Settings">
        {/* VLESS / VMess */}
        {['VLESS', 'VMESS'].includes(form.protocol) && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>UUID *</label>
                <div className="flex gap-1.5">
                  <input className={cn(inputCls, "flex-1")} value={form.uuid || ''}
                    onChange={(e) => update('uuid', e.target.value)}
                    placeholder="Auto-generated if empty" />
                  <button onClick={() => update('uuid', crypto.randomUUID())}
                    className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-[hsl(var(--accent))] text-[11px] shrink-0 transition-colors">
                    Gen
                  </button>
                </div>
              </div>
              {form.protocol === 'VLESS' && (
                <div>
                  <label className={labelCls}>Flow Control</label>
                  <select className={inputCls} value={form.flow || ''}
                    onChange={(e) => update('flow', e.target.value)}>
                    <option value="">None (recommended)</option>
                    <option value="xtls-rprx-vision">xtls-rprx-vision (XTLS-V)</option>
                    <option value="xtls-rprx-direct">xtls-rprx-direct (legacy)</option>
                    <option value="xtls-rprx-splice">xtls-rprx-splice (legacy)</option>
                  </select>
                </div>
              )}
              {form.protocol === 'VMESS' && (
                <div>
                  <label className={labelCls}>AlterID</label>
                  <input className={inputCls} type="number" value={form.alterId || 0}
                    onChange={(e) => update('alterId', +e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trojan / Shadowsocks / Hysteria2 / Mieru */}
        {['TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'MIERU'].includes(form.protocol) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Password *</label>
              <div className="flex gap-1.5">
                <input className={cn(inputCls, "flex-1")} value={form.password || ''}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Auto-generated if empty" />
                <button onClick={() => update('password', crypto.randomUUID().replace(/-/g, '').substring(0, 16))}
                  className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-[hsl(var(--accent))] text-[11px] shrink-0 transition-colors">
                  Gen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shadowsocks Method */}
        {form.protocol === 'SHADOWSOCKS' && (
          <div>
            <label className={labelCls}>Encryption Method</label>
            <select className={inputCls} value={form.method || 'aes-256-gcm'}
              onChange={(e) => update('method', e.target.value)}>
              {SS_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        {/* Hysteria2 Specific */}
        {form.protocol === 'HYSTERIA2' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>SNI *</label>
                <input className={inputCls} value={form.sni || ''}
                  onChange={(e) => update('sni', e.target.value)}
                  placeholder="example.com" />
              </div>
              <div>
                <label className={labelCls}>Obfuscation Type</label>
                <select className={inputCls} value={form.hy2ObfsType || 'none'}
                  onChange={(e) => update('hy2ObfsType', e.target.value)}>
                  {HY2_OBFS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {form.hy2ObfsType && form.hy2ObfsType !== 'none' && (
              <div>
                <label className={labelCls}>Obfs Password</label>
                <input className={inputCls} value={form.hy2ObfsPassword || ''}
                  onChange={(e) => update('hy2ObfsPassword', e.target.value)}
                  placeholder="Obfuscation password" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Bandwidth Up</label>
                <input className={inputCls} value={form.hy2BandwidthUp || '100 mbps'}
                  onChange={(e) => update('hy2BandwidthUp', e.target.value)}
                  placeholder="100 mbps" />
              </div>
              <div>
                <label className={labelCls}>Bandwidth Down</label>
                <input className={inputCls} value={form.hy2BandwidthDown || '100 mbps'}
                  onChange={(e) => update('hy2BandwidthDown', e.target.value)}
                  placeholder="100 mbps" />
              </div>
              <div>
                <label className={labelCls}>Max Clients</label>
                <input className={inputCls} type="number" value={form.hy2MaxClient || 16}
                  onChange={(e) => update('hy2MaxClient', +e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Max Streams</label>
                <input className={inputCls} type="number" value={form.hy2MaxStream || 1024}
                  onChange={(e) => update('hy2MaxStream', +e.target.value)} />
              </div>
              <ToggleField label="Ignore Client Bandwidth"
                value={form.hy2IgnoreClientBW || false}
                onChange={(v) => update('hy2IgnoreClientBW', v)} />
            </div>
          </div>
        )}

        {/* NaiveProxy */}
        {form.protocol === 'NAIVEPROXY' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Upstream Proxy *</label>
                <input className={inputCls} value={form.naiveProxy || ''}
                  onChange={(e) => update('naiveProxy', e.target.value)}
                  placeholder="https://proxy.example.com" />
              </div>
              <div>
                <label className={labelCls}>Protocol</label>
                <select className={inputCls} value={form.naiveProto || 'quic'}
                  onChange={(e) => update('naiveProto', e.target.value)}>
                  <option value="quic">QUIC (recommended)</option>
                  <option value="tcp">TCP</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ToggleField label="Padding" value={form.naivePadding !== false}
                onChange={(v) => update('naivePadding', v)} />
              <div>
                <label className={labelCls}>Padding Length</label>
                <input className={inputCls} type="number" value={form.naivePaddingLength || 512}
                  onChange={(e) => update('naivePaddingLength', +e.target.value)}
                  min={100} max={1000} />
              </div>
              <div>
                <label className={labelCls}>Padding Mode</label>
                <select className={inputCls} value={form.naivePaddingMode || 'random'}
                  onChange={(e) => update('naivePaddingMode', e.target.value)}>
                  <option value="random">Random</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Nonce (optional)</label>
              <input className={inputCls} value={form.naiveNonce || ''}
                onChange={(e) => update('naiveNonce', e.target.value)}
                placeholder="Empty = auto" />
            </div>
          </div>
        )}

        {/* Mieru */}
        {form.protocol === 'MIERU' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Authentication</label>
                <select className={inputCls} value={form.mieruAuth || 'password'}
                  onChange={(e) => update('mieruAuth', e.target.value)}>
                  <option value="password">Password</option>
                  <option value="checksum">Checksum</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Session Placement</label>
                <select className={inputCls} value={form.mieruSessionPlacement || 'random'}
                  onChange={(e) => update('mieruSessionPlacement', e.target.value)}>
                  <option value="random">Random</option>
                  <option value="sequential">Sequential</option>
                  <option value="least-connections">Least Connections</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Sequence Placement</label>
                <select className={inputCls} value={form.mieruSequencePlacement || 'random'}
                  onChange={(e) => update('mieruSequencePlacement', e.target.value)}>
                  <option value="random">Random</option>
                  <option value="sequential">Sequential</option>
                  <option value="least-connections">Least Connections</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Buffer Read Size</label>
                <input className={inputCls} type="number" value={form.mieruBufferReadSize || 16384}
                  onChange={(e) => update('mieruBufferReadSize', +e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Buffer Write Size</label>
              <input className={inputCls} type="number" value={form.mieruBufferWriteSize || 16384}
                onChange={(e) => update('mieruBufferWriteSize', +e.target.value)} />
            </div>
          </div>
        )}

        {/* TUIC */}
        {form.protocol === 'TUIC' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>SNI *</label>
                <input className={inputCls} value={form.sni || ''}
                  onChange={(e) => update('sni', e.target.value)}
                  placeholder="example.com" />
              </div>
              <div>
                <label className={labelCls}>Congestion Control</label>
                <select className={inputCls} value={form.tuicCongestion || 'bbr'}
                  onChange={(e) => update('tuicCongestion', e.target.value)}>
                  <option value="bbr">BBR (recommended)</option>
                  <option value="cubic">Cubic</option>
                  <option value="new_reno">New Reno</option>
                </select>
              </div>
            </div>
            <ToggleField label="Zero-RTT Handshake"
              description="Enable 0-RTT for faster reconnection"
              value={form.tuicZeroRtt || false}
              onChange={(v) => update('tuicZeroRtt', v)} />
          </div>
        )}
      </Section>
    </div>
  );
}

// ──── Shared Components ────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function ToggleField({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-bg-raised rounded-lg px-3 py-2.5">
      <div>
        <div className="text-xs text-fg-muted">{label}</div>
        {description && <div className="text-[10px] text-fg-muted mt-0.5">{description}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", value ? "bg-[hsl(var(--accent))]" : "bg-bg-sunken")}>
        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform",
          value ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
