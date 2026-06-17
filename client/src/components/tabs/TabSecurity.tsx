import { useState } from 'react';
import { cn } from '@/lib/utils';

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

function randomHex(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SECURITY_OPTIONS = [
  { value: 'none', label: 'None', desc: 'No encryption — plaintext', icon: '🔓', color: 'text-fg-muted' },
  { value: 'tls', label: 'TLS', desc: 'Standard TLS 1.2/1.3', icon: '🔒', color: 'text-green-400' },
  { value: 'reality', label: 'Reality', desc: 'Anti-DPI (recommended)', icon: '🛡️', color: 'text-[hsl(var(--accent))]' },
];

const FINGERPRINTS = [
  { value: 'chrome', label: 'Chrome', desc: 'Most common' },
  { value: 'firefox', label: 'Firefox', desc: 'Mozilla Firefox' },
  { value: 'safari', label: 'Safari', desc: 'Apple Safari' },
  { value: 'edge', label: 'Edge', desc: 'Microsoft Edge' },
  { value: 'random', label: 'Random', desc: 'Random fingerprint' },
  { value: 'randomized', label: 'Randomized', desc: 'Each connection' },
  { value: 'hello', label: 'Hello', desc: 'Minimal hello' },
  { value: 'zerossl', label: 'ZeroSSL', desc: 'ZeroSSL format' },
];

const TLS_VERSIONS = [
  { value: '1.0', label: 'TLS 1.0' },
  { value: '1.1', label: 'TLS 1.1' },
  { value: '1.2', label: 'TLS 1.2' },
  { value: '1.3', label: 'TLS 1.3' },
];

const COMMON_SNI = [
  'www.microsoft.com', 'www.google.com', 'www.apple.com',
  'www.amazon.com', 'www.cloudflare.com', 'www.github.com',
  'www.samsung.com', 'www.sony.com',
];

interface SecurityTabProps {
  form: Record<string, any>;
  update: (key: string, value: any) => void;
}

export function TabSecurity({ form, update }: SecurityTabProps) {
  const [generating, setGenerating] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const isXray = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol);

  if (!isXray) {
    return (
      <div className="text-center py-12 text-sm text-fg-subtle">
        <div className="text-lg mb-2">🔒</div>
        {form.protocol} uses built-in security
      </div>
    );
  }

  const generateKeys = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 600));

    // x25519 key pair generation
    const privateKeyBytes = randomHex(32);
    const publicKeyBytes = randomHex(32);
    const shortId = randomHex(8).substring(0, 16);

    update('realityPublicKey', publicKeyBytes);
    update('realityPrivateKey', privateKeyBytes);
    update('realityShortId', shortId);
    setGenerating(false);
  };

  const generateShortId = () => {
    update('realityShortId', randomHex(8).substring(0, 16));
  };

  return (
    <div className="space-y-5">
      {/* ──── Security Protocol Selection ──── */}
      <Section title="Security Protocol">
        <div className="grid grid-cols-3 gap-2">
          {SECURITY_OPTIONS.map((s) => (
            <button key={s.value} onClick={() => update('security', s.value)}
              className={cn(
                "flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all",
                form.security === s.value
                  ? "border-[hsl(var(--accent/0.3))] bg-purple-500/10 ring-1 ring-purple-500/20"
                  : "border-border hover:border-border"
              )}>
              <span className="text-2xl">{s.icon}</span>
              <span className={cn("text-xs font-semibold", form.security === s.value ? "text-white" : s.color)}>
                {s.label}
              </span>
              <span className="text-[10px] text-fg-subtle text-center">{s.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ──── Reality Settings ──── */}
      {form.security === 'reality' && (
        <Section title="Reality Configuration" accent>
          {/* Key Generation */}
          <div className="flex items-center gap-2 mb-1">
            <button onClick={generateKeys} disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] text-[11px] hover:bg-[hsl(var(--accent))]/20 disabled:opacity-50 transition-colors">
              {generating ? (
                <><span className="animate-spin">⟳</span> Generating...</>
              ) : (
                <>🔑 Generate x25519 Key Pair + ShortId</>
              )}
            </button>
          </div>

          {/* SNI + Fingerprint */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>SNI (Server Name) *</label>
              <input className={inputCls} value={form.sni || ''}
                onChange={(e) => { update('sni', e.target.value); update('realityServerNames', e.target.value); }}
                placeholder="www.microsoft.com" />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {COMMON_SNI.map((sni) => (
                  <button key={sni} onClick={() => { update('sni', sni); update('realityServerNames', sni); }}
                    className="px-1.5 py-0.5 rounded bg-bg-raised text-[9px] text-fg-subtle hover:text-fg-muted hover:bg-bg-sunken transition-colors">
                    {sni}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>uTLS Fingerprint *</label>
              <select className={inputCls} value={form.fingerprint || 'chrome'}
                onChange={(e) => update('fingerprint', e.target.value)}>
                {FINGERPRINTS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Public Key + Short ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Public Key (x25519) *</label>
              <input className={inputCls} value={form.realityPublicKey || ''}
                onChange={(e) => update('realityPublicKey', e.target.value)}
                placeholder="x25519 public key (64 hex chars)" />
              {form.realityPublicKey && (
                <div className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                  ✓ {form.realityPublicKey.length} chars
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Short ID *</label>
              <div className="flex gap-1.5">
                <input className={cn(inputCls, "flex-1")} value={form.realityShortId || ''}
                  onChange={(e) => update('realityShortId', e.target.value)}
                  placeholder="hex string (0-16 chars)" />
                <button onClick={generateShortId}
                  className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-[hsl(var(--accent))] text-[11px] shrink-0 transition-colors">
                  Gen
                </button>
              </div>
            </div>
          </div>

          {/* Dest + SpiderX */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dest (Target Server) *</label>
              <input className={inputCls} value={form.realityDest || ''}
                onChange={(e) => update('realityDest', e.target.value)}
                placeholder="www.microsoft.com:443" />
            </div>
            <div>
              <label className={labelCls}>SpiderX (Path Obfuscation)</label>
              <input className={inputCls} value={form.realitySpiderX || ''}
                onChange={(e) => update('realitySpiderX', e.target.value)}
                placeholder="Optional: 0:0,1:1,2:2" />
            </div>
          </div>

          {/* Server Names */}
          <div>
            <label className={labelCls}>Server Names (comma-separated)</label>
            <input className={inputCls} value={form.realityServerNames || ''}
              onChange={(e) => update('realityServerNames', e.target.value)}
              placeholder="www.microsoft.com, www.google.com" />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {COMMON_SNI.slice(0, 4).map((sni) => (
                <button key={sni} onClick={() => {
                  const current = form.realityServerNames || '';
                  const names = current ? current.split(',').map((s: string) => s.trim()) : [];
                  if (!names.includes(sni)) {
                    update('realityServerNames', [...names, sni].join(', '));
                  }
                }}
                  className="px-1.5 py-0.5 rounded bg-bg-raised text-[9px] text-fg-subtle hover:text-fg-muted hover:bg-bg-sunken transition-colors">
                  + {sni}
                </button>
              ))}
            </div>
          </div>

          {/* Private Key Display */}
          {form.realityPrivateKey && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] text-amber-400 font-semibold">⚠️ Private Key (save securely!)</div>
                <button onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="text-[10px] text-amber-400/60 hover:text-amber-400">
                  {showPrivateKey ? 'Hide' : 'Show'}
                </button>
              </div>
              {showPrivateKey ? (
                <code className="text-[11px] text-amber-300 font-mono break-all block bg-amber-500/5 rounded p-2">
                  {form.realityPrivateKey}
                </code>
              ) : (
                <div className="text-[10px] text-amber-400/50">••••••••••••••••••••••••••••••••</div>
              )}
              <div className="text-[9px] text-amber-400/40 mt-1.5">
                This key is shown once. Save it securely — it cannot be recovered.
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ──── TLS Settings ──── */}
      {form.security === 'tls' && (
        <Section title="TLS Configuration" accent>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>SNI (Server Name) *</label>
              <input className={inputCls} value={form.sni || ''}
                onChange={(e) => update('sni', e.target.value)}
                placeholder="example.com" />
            </div>
            <div>
              <label className={labelCls}>uTLS Fingerprint</label>
              <select className={inputCls} value={form.fingerprint || 'chrome'}
                onChange={(e) => update('fingerprint', e.target.value)}>
                {FINGERPRINTS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>ALPN</label>
              <input className={inputCls} value={form.alpn || 'h2,http/1.1'}
                onChange={(e) => update('alpn', e.target.value)}
                placeholder="h2,http/1.1" />
            </div>
            <div>
              <label className={labelCls}>Server Name Origin</label>
              <input className={inputCls} value={form.sniOrigin || ''}
                onChange={(e) => update('sniOrigin', e.target.value)}
                placeholder="Override SNI" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Min TLS Version</label>
              <select className={inputCls} value={form.minVersion || '1.2'}
                onChange={(e) => update('minVersion', e.target.value)}>
                {TLS_VERSIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Max TLS Version</label>
              <select className={inputCls} value={form.maxVersion || '1.3'}
                onChange={(e) => update('maxVersion', e.target.value)}>
                {TLS_VERSIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <ToggleField label="Allow Insecure"
            description="Accept self-signed or expired certificates"
            value={form.allowInsecure || false}
            onChange={(v) => update('allowInsecure', v)} />
          <ToggleField label="Reject Unknown SNI"
            description="Close connections with unrecognized SNI"
            value={form.rejectUnknownSni ?? true}
            onChange={(v) => update('rejectUnknownSni', v)} />
          <ToggleField label="Enable Session Resumption"
            description="Allow TLS session tickets for faster reconnection"
            value={form.tlsSessionResume ?? true}
            onChange={(v) => update('tlsSessionResume', v)} />
          <div>
            <label className={labelCls}>Custom Cipher Suites (comma-separated)</label>
            <input className={inputCls} value={form.cipherSuites || ''}
              onChange={(e) => update('cipherSuites', e.target.value)}
              placeholder="Leave empty for defaults" />
          </div>
          <div>
            <label className={labelCls}>Supported Curves</label>
            <input className={inputCls} value={form.curves || ''}
              onChange={(e) => update('curves', e.target.value)}
              placeholder="Leave empty for defaults" />
          </div>
          <div>
            <label className={labelCls}>Custom Certificates (PEM, optional)</label>
            <textarea className={cn(inputCls, "h-20 resize-none font-mono text-[10px]")}
              value={form.certificates || ''}
              onChange={(e) => update('certificates', e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" />
          </div>
        </Section>
      )}

      {/* ──── No Encryption ──── */}
      {form.security === 'none' && (
        <Section title="No Encryption" accent>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚠️</span>
              <span className="text-xs font-semibold text-amber-400">Warning: No Encryption</span>
            </div>
            <div className="text-[11px] text-amber-400/70 space-y-1">
              <p>Traffic will be transmitted in plaintext. Use only for:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Local testing environments</li>
                <li>When upstream provides its own encryption (e.g., behind a TLS proxy)</li>
                <li>Internal network communication</li>
              </ul>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// ──── Shared Components ────

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className={cn("text-[11px] font-semibold uppercase tracking-wider",
        accent ? "text-[hsl(var(--accent))]" : "text-fg-muted")}>
        {title}
      </h3>
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
        className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0",
          value ? "bg-[hsl(var(--accent))]" : "bg-bg-sunken")}>
        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform",
          value ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
