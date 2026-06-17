import { useState } from 'react';
import { cn } from '@/lib/utils';

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

const DEST_OVERRIDE_OPTIONS = [
  { value: 'http', label: 'HTTP', desc: 'Layer-7 HTTP detection', color: 'text-blue-400' },
  { value: 'tls', label: 'TLS', desc: 'TLS ClientHello parsing', color: 'text-green-400' },
  { value: 'quic', label: 'QUIC', desc: 'QUIC protocol detection', color: 'text-[hsl(var(--accent))]' },
  { value: 'stun', label: 'STUN', desc: 'STUN/TURN detection', color: 'text-amber-400' },
  { value: 'dns', label: 'DNS', desc: 'DNS-over-HTTPS sniffing', color: 'text-cyan-400' },
  { value: 'bittorrent', label: 'BitTorrent', desc: 'BitTorrent traffic detection', color: 'text-red-400' },
];

const CIDR_EXAMPLES = [
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
  '100.64.0.0/10', 'fc00::/7',
];

const DOMAIN_EXAMPLES = [
  '*.google.com', '*.facebook.com', '*.microsoft.com',
  'localhost', '*.local', '*.lan',
];

interface SniffingTabProps {
  form: Record<string, any>;
  update: (key: string, value: any) => void;
}

export function TabSniffing({ form, update }: SniffingTabProps) {
  const isXray = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol);

  if (!isXray) {
    return (
      <div className="text-center py-12 text-sm text-fg-subtle">
        <div className="text-lg mb-2">🔍</div>
        {form.protocol} does not support sniffing
      </div>
    );
  }

  const destOverride = form.sniffingDestOverride || ['http', 'tls'];
  const excludedDomains = form.sniffingExcludedDomains || '';
  const excludedIPs = form.sniffingExcludedIPs || '';
  const excludedCIDRs = form.sniffingExcludedCIDRs || '';

  const toggleDest = (dest: string) => {
    const next = destOverride.includes(dest)
      ? destOverride.filter((d: string) => d !== dest)
      : [...destOverride, dest];
    update('sniffingDestOverride', next);
  };

  return (
    <div className="space-y-5">
      {/* Master Toggle */}
      <Section title="Protocol Detection">
        <div className="flex items-center justify-between bg-bg-raised rounded-xl px-4 py-3">
          <div>
            <div className="text-sm font-medium text-fg">Sniffing</div>
            <div className="text-[11px] text-fg-subtle mt-0.5">
              Detect application protocol from traffic and route by domain
            </div>
          </div>
          <button onClick={() => update('sniffing', !form.sniffing)}
            className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0",
              form.sniffing ? "bg-[hsl(var(--accent))]" : "bg-bg-sunken")}>
            <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform",
              form.sniffing ? "translate-x-[22px]" : "translate-x-0.5")} />
          </button>
        </div>
      </Section>

      {/* Dest Override Selection */}
      <Section title="Destination Override">
        <div className="text-[10px] text-fg-muted mb-2">
          Select which protocols to detect. Sniffed protocols override the destination address for routing.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEST_OVERRIDE_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => toggleDest(opt.value)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left",
                destOverride.includes(opt.value)
                  ? "border-purple-500/40 bg-purple-500/5"
                  : "border-border hover:border-border"
              )}>
              <div className={cn(
                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                destOverride.includes(opt.value)
                  ? "border-purple-500 bg-purple-500"
                  : "border-fg-subtle"
              )}>
                {destOverride.includes(opt.value) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <div className={cn("text-xs font-medium", destOverride.includes(opt.value) ? "text-fg" : "text-fg-muted")}>
                  {opt.label}
                </div>
                <div className="text-[10px] text-fg-muted">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Advanced Options */}
      <Section title="Advanced Options">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between bg-bg-raised rounded-lg px-3 py-2.5">
            <div>
              <div className="text-xs text-fg-muted">Metadata Only</div>
              <div className="text-[10px] text-fg-muted mt-0.5">
                Only extract metadata without modifying destination
              </div>
            </div>
            <button onClick={() => update('sniffingMetadataOnly', !form.sniffingMetadataOnly)}
              className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0",
                form.sniffingMetadataOnly ? "bg-[hsl(var(--accent))]" : "bg-bg-sunken")}>
              <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform",
                form.sniffingMetadataOnly ? "translate-x-4" : "translate-x-0.5")} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-bg-raised rounded-lg px-3 py-2.5">
            <div>
              <div className="text-xs text-fg-muted">Route Only</div>
              <div className="text-[10px] text-fg-muted mt-0.5">
                Use sniffed domain for routing decisions only, not for connection destination
              </div>
            </div>
            <button onClick={() => update('sniffingRouteOnly', !form.sniffingRouteOnly)}
              className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0",
                form.sniffingRouteOnly ? "bg-[hsl(var(--accent))]" : "bg-bg-sunken")}>
              <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-transform",
                form.sniffingRouteOnly ? "translate-x-4" : "translate-x-0.5")} />
            </button>
          </div>
        </div>
      </Section>

      {/* Exclusions */}
      <Section title="Exclusions">
        <div className="text-[10px] text-fg-muted mb-2">
          Domains and IPs matching these patterns will be excluded from sniffing.
          Use CIDR notation for IP ranges and wildcards for domains.
        </div>

        {/* Excluded Domains */}
        <TagInputWithExamples
          label="Excluded Domains"
          value={excludedDomains}
          onChange={(v) => update('sniffingExcludedDomains', v)}
          placeholder="Add domain (e.g., *.example.com)"
          examples={DOMAIN_EXAMPLES}
        />

        {/* Excluded IPs */}
        <TagInputWithExamples
          label="Excluded IPs / CIDR"
          value={excludedIPs}
          onChange={(v) => update('sniffingExcludedIPs', v)}
          placeholder="Add IP or CIDR (e.g., 10.0.0.0/8)"
          examples={CIDR_EXAMPLES}
          validate={(val) => {
            if (val.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/)) return true;
            if (val.match(/^[a-f0-9:]+(\/\d{1,3})?$/i)) return true;
            return false;
          }}
        />

        {/* Excluded CIDRs */}
        <TagInputWithExamples
          label="Additional CIDR Exclusions"
          value={excludedCIDRs}
          onChange={(v) => update('sniffingExcludedCIDRs', v)}
          placeholder="Add CIDR (e.g., 100.64.0.0/10)"
          examples={CIDR_EXAMPLES}
          validate={(val) => val.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/) !== null}
        />
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

function TagInputWithExamples({ label, value, onChange, placeholder, examples, validate }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  examples: string[]; validate?: (val: string) => boolean;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const tags = value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const addTag = () => {
    const tag = input.trim();
    if (!tag) return;
    if (tags.includes(tag)) { setError('Already exists'); return; }
    if (validate && !validate(tag)) { setError('Invalid format'); return; }
    setError('');
    onChange([...tags, tag].join(', '));
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag).join(', '));
  };

  const addExample = (ex: string) => {
    if (!tags.includes(ex)) {
      onChange([...tags, ex].join(', '));
    }
    setShowExamples(false);
  };

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded bg-bg-raised text-[10px] text-fg-muted">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-fg-subtle hover:text-red-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input className={cn(inputCls, "flex-1", error && "border-red-500/50")} value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder} />
        <button onClick={addTag}
          className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-fg text-[11px]">+</button>
        <button onClick={() => setShowExamples(!showExamples)}
          className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-fg text-[11px]">
          ?
        </button>
      </div>
      {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
      {showExamples && (
        <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-bg-raised rounded-lg">
          <span className="text-[10px] text-fg-subtle">Examples:</span>
          {examples.map((ex) => (
            <button key={ex} onClick={() => addExample(ex)}
              className="px-2 py-0.5 rounded bg-bg-raised text-[10px] text-fg-muted hover:text-fg hover:bg-bg-sunken">
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
