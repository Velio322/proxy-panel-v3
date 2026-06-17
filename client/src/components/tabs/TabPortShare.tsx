import { useState } from 'react';
import { cn } from '@/lib/utils';

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC'];

const PROTOCOL_COLORS: Record<string, string> = {
  VLESS: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  VMESS: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  TROJAN: 'bg-red-500/15 text-red-400 border-red-500/20',
  SHADOWSOCKS: 'bg-fg-subtle/15 text-fg-muted border-fg-subtle/20',
  HYSTERIA2: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  NAIVEPROXY: 'bg-green-500/15 text-green-400 border-green-500/20',
  MIERU: 'bg-[hsl(var(--accent-light))] text-[hsl(var(--accent))] border-[hsl(var(--accent/0.2))]',
  TUIC: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
};

const EXAMPLE_CONFIGS = [
  { label: 'VLESS + Hy2 on :443', protocols: ['VLESS', 'HYSTERIA2'], sni: ['vless.example.com', 'hy2.example.com'] },
  { label: 'VLESS + Hy2 + Naive on :443', protocols: ['VLESS', 'HYSTERIA2', 'NAIVEPROXY'], sni: ['vless.example.com', 'hy2.example.com', 'naive.example.com'] },
  { label: 'All Xray protocols on :443', protocols: ['VLESS', 'VMESS', 'TROJAN'], sni: ['vless.example.com', 'vmess.example.com', 'trojan.example.com'] },
];

interface PortShareTabProps {
  form: Record<string, any>;
  update: (key: string, value: any) => void;
}

export function TabPortShare({ form, update }: PortShareTabProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const shares = form.portShares || [];

  const addShare = (preset?: { protocol: string; tag: string; host: string }) => {
    const newShare = {
      id: `ps-${Date.now()}`,
      protocol: preset?.protocol || 'VLESS',
      tag: preset?.tag || `ps-${Date.now()}`,
      host: preset?.host || '',
      path: '',
      enable: true,
      security: 'reality',
      fingerprint: 'chrome',
      sni: preset?.host || '',
    };
    update('portShares', [...shares, newShare]);
    setExpandedIdx(shares.length);
  };

  const updateShare = (idx: number, key: string, val: any) => {
    const updated = [...shares];
    updated[idx] = { ...updated[idx], [key]: val };
    update('portShares', updated);
  };

  const removeShare = (idx: number) => {
    update('portShares', shares.filter((_: any, i: number) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const applyPreset = (preset: typeof EXAMPLE_CONFIGS[0]) => {
    const newShares = preset.protocols.map((proto, i) => ({
      id: `ps-${Date.now()}-${i}`,
      protocol: proto,
      tag: `${proto.toLowerCase()}-shared`,
      host: preset.sni[i] || '',
      path: '',
      enable: true,
      security: proto === 'VLESS' ? 'reality' : 'tls',
      fingerprint: 'chrome',
      sni: preset.sni[i] || '',
    }));
    update('portShares', newShares);
  };

  return (
    <div className="space-y-5">
      {/* ──── How It Works ──── */}
      <Section title="Port-Sharing (SNI Routing)">
        <div className="bg-bg-raised rounded-xl p-4 space-y-2">
          <div className="text-[11px] text-fg-muted font-medium">How it works:</div>
          <div className="text-[10px] text-fg-subtle space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[hsl(var(--accent-light))] text-[hsl(var(--accent))] flex items-center justify-center text-[9px] font-bold">1</span>
              Each protocol gets an internal port (127.0.0.1:10xxx)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[hsl(var(--accent-light))] text-[hsl(var(--accent))] flex items-center justify-center text-[9px] font-bold">2</span>
              HAProxy listens on :443 and inspects TLS ClientHello
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[hsl(var(--accent-light))] text-[hsl(var(--accent))] flex items-center justify-center text-[9px] font-bold">3</span>
              Routes traffic by SNI to the correct internal port
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[hsl(var(--accent-light))] text-[hsl(var(--accent))] flex items-center justify-center text-[9px] font-bold">4</span>
              External clients connect on :443 — all protocols work seamlessly
            </div>
          </div>
        </div>
      </Section>

      {/* ──── Quick Presets ──── */}
      <Section title="Quick Presets">
        <div className="grid grid-cols-3 gap-2">
          {EXAMPLE_CONFIGS.map((preset, i) => (
            <button key={i} onClick={() => applyPreset(preset)}
              className="flex flex-col items-start gap-1.5 px-3 py-3 rounded-xl border border-border hover:border-[hsl(var(--accent/0.3))] hover:bg-purple-500/5 transition-all text-left">
              <span className="text-[11px] font-medium text-fg-muted">{preset.label}</span>
              <div className="flex flex-wrap gap-1">
                {preset.protocols.map((p) => (
                  <span key={p} className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium border", PROTOCOL_COLORS[p])}>
                    {p}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ──── Port Shares List ──── */}
      <Section title={`Port Shares (${shares.length})`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-fg-muted">
            Configure additional protocol entries for this shared port
          </span>
          <button onClick={() => addShare()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] text-[11px] hover:bg-[hsl(var(--accent))]/20 transition-colors">
            + Add Port Share
          </button>
        </div>

        {shares.length === 0 ? (
          <div className="bg-bg-raised/20 rounded-xl border border-dashed border-border p-8 text-center">
            <div className="text-lg mb-2">🔌</div>
            <div className="text-xs text-fg-subtle mb-1">No port shares configured</div>
            <div className="text-[10px] text-fg-muted">Add one to multiplex this inbound on the shared port</div>
          </div>
        ) : (
          <div className="space-y-2">
            {shares.map((share: any, idx: number) => (
              <div key={share.id || idx}
                className={cn(
                  "bg-bg-raised border rounded-xl overflow-hidden transition-all",
                  expandedIdx === idx ? "border-[hsl(var(--accent/0.3))]" : "border-border"
                )}>
                {/* Share Header */}
                <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-bg-raised/20"
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}>
                  <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border",
                    PROTOCOL_COLORS[share.protocol] || 'bg-fg-subtle/15 text-fg-muted border-fg-subtle/20')}>
                    {share.protocol}
                  </span>
                  <span className="text-xs text-fg-muted flex-1 truncate">{share.tag}</span>
                  {share.host && (
                    <span className="text-[10px] text-fg-subtle font-mono">@{share.host}</span>
                  )}
                  {share.path && (
                    <span className="text-[10px] text-fg-muted">/{share.path}</span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeShare(idx); }}
                    className="p-1 rounded hover:bg-red-500/10 text-fg-subtle hover:text-red-400 transition-colors">
                    ×
                  </button>
                  <div className={cn("text-fg-muted transition-transform",
                    expandedIdx === idx && "rotate-90")}>▸</div>
                </div>

                {/* Expanded Settings */}
                {expandedIdx === idx && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2.5">
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className={labelCls}>Protocol</label>
                        <select className={inputCls} value={share.protocol}
                          onChange={(e) => updateShare(idx, 'protocol', e.target.value)}>
                          {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Tag</label>
                        <input className={inputCls} value={share.tag}
                          onChange={(e) => updateShare(idx, 'tag', e.target.value)}
                          placeholder="vless-shared" />
                      </div>
                      <div>
                        <label className={labelCls}>Security</label>
                        <select className={inputCls} value={share.security || 'reality'}
                          onChange={(e) => updateShare(idx, 'security', e.target.value)}>
                          <option value="none">None</option>
                          <option value="tls">TLS</option>
                          <option value="reality">Reality</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={labelCls}>SNI Host (for ACL routing)</label>
                        <input className={inputCls} value={share.host || ''}
                          onChange={(e) => updateShare(idx, 'host', e.target.value)}
                          placeholder="vless.example.com" />
                      </div>
                      <div>
                        <label className={labelCls}>Path (for gRPC/WS)</label>
                        <input className={inputCls} value={share.path || ''}
                          onChange={(e) => updateShare(idx, 'path', e.target.value)}
                          placeholder="Optional: /grpc-service" />
                      </div>
                    </div>
                    {share.security === 'reality' && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className={labelCls}>Public Key</label>
                          <input className={inputCls} value={share.publicKey || ''}
                            onChange={(e) => updateShare(idx, 'publicKey', e.target.value)}
                            placeholder="x25519 public key" />
                        </div>
                        <div>
                          <label className={labelCls}>Short ID</label>
                          <input className={inputCls} value={share.shortId || ''}
                            onChange={(e) => updateShare(idx, 'shortId', e.target.value)}
                            placeholder="hex string" />
                        </div>
                      </div>
                    )}
                    {share.security === 'tls' && (
                      <div>
                        <label className={labelCls}>Fingerprint</label>
                        <select className={inputCls} value={share.fingerprint || 'chrome'}
                          onChange={(e) => updateShare(idx, 'fingerprint', e.target.value)}>
                          {['chrome', 'firefox', 'safari', 'edge', 'random'].map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
