import { useState } from 'react';
import { cn } from '@/lib/utils';

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

const TRANSPORTS = [
  { value: 'tcp', label: 'TCP', desc: 'Raw TCP', icon: '🔗' },
  { value: 'ws', label: 'WebSocket', desc: 'Browser-friendly', icon: '🌐' },
  { value: 'grpc', label: 'gRPC', desc: 'Multiplexed streams', icon: '⚡' },
  { value: 'httpupgrade', label: 'HTTPUpgrade', desc: 'Upgrade handshake', icon: '🔄' },
  { value: 'xhttp', label: 'XHTTP', desc: 'Extended HTTP', icon: '📡' },
  { value: 'h2', label: 'HTTP/2', desc: 'HTTP/2 transport', icon: '🚀' },
  { value: 'kcp', label: 'mKCP', desc: 'UDP-based (game/video)', icon: '🎮' },
] as const;

const KCP_HEADERS = [
  { value: 'none', label: 'None' },
  { value: 'srtp', label: 'SRTP (video)' },
  { value: 'utp', label: 'uTP (BitTorrent)' },
  { value: 'wechat-video', label: 'WeChat Video' },
  { value: 'dtls', label: 'DTLS' },
  { value: 'wireguard', label: 'WireGuard' },
];

const WS_COMPRESSIONS = ['none', 'zstd', 'br', 'gzip', 'deflate'];

interface TransportTabProps {
  form: Record<string, any>;
  update: (key: string, value: any) => void;
}

export function TabTransport({ form, update }: TransportTabProps) {
  const isXray = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol);

  if (!isXray) {
    return (
      <div className="text-center py-12 text-sm text-fg-subtle">
        <div className="text-lg mb-2">⚙️</div>
        {form.protocol} uses default transport settings
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Transport Selection Grid */}
      <Section title="Network Transport">
        <div className="grid grid-cols-4 gap-2">
          {TRANSPORTS.map((t) => (
            <button key={t.value} onClick={() => update('transport', t.value)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-3 rounded-xl border transition-all",
                form.transport === t.value
                  ? "border-[hsl(var(--accent/0.3))] bg-purple-500/10 text-[hsl(var(--accent))] ring-1 ring-purple-500/20"
                  : "border-border text-fg-subtle hover:text-fg-muted hover:border-border"
              )}>
              <span className="text-lg">{t.icon}</span>
              <span className="text-[11px] font-medium">{t.label}</span>
              <span className="text-[9px] opacity-50">{t.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Transport-Specific Settings */}
      {form.transport === 'tcp' && <TcpSettings form={form} update={update} />}
      {form.transport === 'ws' && <WsSettings form={form} update={update} />}
      {form.transport === 'grpc' && <GrpcSettings form={form} update={update} />}
      {form.transport === 'h2' && <H2Settings form={form} update={update} />}
      {form.transport === 'httpupgrade' && <HttpUpgradeSettings form={form} update={update} />}
      {form.transport === 'xhttp' && <XhttpSettings form={form} update={update} />}
      {form.transport === 'kcp' && <KcpSettings form={form} update={update} />}
    </div>
  );
}

// ──── TCP ────

function TcpSettings({ form, update }: TransportTabProps) {
  return (
    <Section title="TCP Settings">
      <div className="grid grid-cols-2 gap-3">
        <ToggleField label="Accept Proxy Protocol" value={form.tcpAcceptProxy}
          onChange={(v) => update('tcpAcceptProxy', v)} />
        <ToggleField label="Header Obfuscation" value={form.tcpHeaderEnabled}
          onChange={(v) => update('tcpHeaderEnabled', v)} />
      </div>

      {form.tcpHeaderEnabled && (
        <div className="bg-bg-raised rounded-lg p-3 space-y-2.5">
          <div>
            <label className={labelCls}>Header Type</label>
            <select className={inputCls} value={form.tcpHeaderType || 'none'}
              onChange={(e) => update('tcpHeaderType', e.target.value)}>
              <option value="none">None</option>
              <option value="http">HTTP</option>
            </select>
          </div>
          {form.tcpHeaderType === 'http' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Version" value={form.tcpHttpVersion || '1.1'}
                  onChange={(v) => update('tcpHttpVersion', v)} placeholder="1.1" />
                <Field label="Method" value={form.tcpHttpMethod || 'GET'}
                  onChange={(v) => update('tcpHttpMethod', v)} placeholder="GET" />
              </div>
              <Field label="Path" value={form.tcpHttpPath || '/, /whathideme'}
                onChange={(v) => update('tcpHttpPath', v)} placeholder="/, /whathideme" />
              <TagInput label="User-Agent" value={form.tcpHttpUserAgent || ''}
                onChange={(v) => update('tcpHttpUserAgent', v)}
                placeholder="Mozilla/5.0 ..." />
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ──── WebSocket ────

function WsSettings({ form, update }: TransportTabProps) {
  return (
    <Section title="WebSocket Settings">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Path *" value={form.wsPath || '/'}
          onChange={(v) => update('wsPath', v)} placeholder="/" />
        <Field label="Host (for CDN)" value={form.wsHost || ''}
          onChange={(v) => update('wsHost', v)} placeholder="example.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max Early Data" value={form.wsMaxEarlyData || 0}
          onChange={(v) => update('wsMaxEarlyData', +v)} type="number" placeholder="0 = disabled" />
        <ToggleField label="Browser Forwarding Agent"
          description="Forward real browser UA via WebSocket"
          value={form.wsUseBrowserAgent || false}
          onChange={(v) => update('wsUseBrowserAgent', v)} />
      </div>
      <div>
        <label className={labelCls}>Custom Headers</label>
        <TagInput label="" value={form.wsHeaders || ''}
          onChange={(v) => update('wsHeaders', v)}
          placeholder="Host: example.com" />
      </div>
      <div>
        <label className={labelCls}>Compression</label>
        <div className="flex gap-1.5">
          {WS_COMPRESSIONS.map((c) => (
            <button key={c} onClick={() => update('wsCompression', c)}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] border transition-all",
                form.wsCompression === c
                  ? "border-[hsl(var(--accent/0.3))] bg-purple-500/10 text-[hsl(var(--accent))]"
                  : "border-border text-fg-subtle hover:text-fg-muted"
              )}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ──── gRPC ────

function GrpcSettings({ form, update }: TransportTabProps) {
  return (
    <Section title="gRPC Settings">
      <Field label="Service Name *" value={form.grpcServiceName || ''}
        onChange={(v) => update('grpcServiceName', v)} placeholder="grpc-service" />
      <div className="grid grid-cols-2 gap-3">
        <ToggleField label="Multi-Mode"
          description="Enable multiplexed streams per connection"
          value={form.grpcMultiMode || false}
          onChange={(v) => update('grpcMultiMode', v)} />
        <ToggleField label="Health Check"
          description="Enable gRPC health checking"
          value={form.grpcHealthCheck || false}
          onChange={(v) => update('grpcHealthCheck', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Idle Timeout (s)" value={form.grpcIdleTimeout || 10}
          onChange={(v) => update('grpcIdleTimeout', +v)} type="number" />
        <Field label="Max Concurrent Streams" value={form.grpcMaxStreams || 0}
          onChange={(v) => update('grpcMaxStreams', +v)} type="number" placeholder="0 = unlimited" />
      </div>
      <Field label="User-Agent (optional)" value={form.grpcUserAgent || ''}
        onChange={(v) => update('grpcUserAgent', v)} placeholder="Mozilla/5.0 ..." />
    </Section>
  );
}

// ──── HTTP/2 ────

function H2Settings({ form, update }: TransportTabProps) {
  return (
    <Section title="HTTP/2 Settings">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Path" value={form.h2Path || '/'}
          onChange={(v) => update('h2Path', v)} placeholder="/" />
        <Field label="Host (comma-separated)" value={form.h2Host || ''}
          onChange={(v) => update('h2Host', v)} placeholder="example.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Method" value={form.h2Method || 'PUT'}
          onChange={(v) => update('h2Method', v)} placeholder="PUT" />
        <ToggleField label="Pass Through URI"
          description="Pass the full URI to the upstream"
          value={form.h2PassThrough || false}
          onChange={(v) => update('h2PassThrough', v)} />
      </div>
      <TagInput label="Custom Headers" value={form.h2Headers || ''}
        onChange={(v) => update('h2Headers', v)}
        placeholder="X-Custom: value" />
    </Section>
  );
}

// ──── HTTPUpgrade ────

function HttpUpgradeSettings({ form, update }: TransportTabProps) {
  return (
    <Section title="HTTPUpgrade Settings">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Path" value={form.httpupgradePath || '/'}
          onChange={(v) => update('httpupgradePath', v)} placeholder="/" />
        <Field label="Host" value={form.httpupgradeHost || ''}
          onChange={(v) => update('httpupgradeHost', v)} placeholder="example.com" />
      </div>
      <ToggleField label="Accept Proxy Protocol"
        description="Enable PROXY protocol support"
        value={form.httpupgradeAcceptProxy || false}
        onChange={(v) => update('httpupgradeAcceptProxy', v)} />
    </Section>
  );
}

// ──── XHTTP ────

function XhttpSettings({ form, update }: TransportTabProps) {
  return (
    <Section title="XHTTP Settings">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Path" value={form.xhttpPath || ''}
          onChange={(v) => update('xhttpPath', v)} />
        <div>
          <label className={labelCls}>Mode</label>
          <select className={inputCls} value={form.xhttpMode || 'auto'}
            onChange={(e) => update('xhttpMode', e.target.value)}>
            <option value="auto">auto</option>
            <option value="packet-up">packet-up</option>
            <option value="stream-up">stream-up</option>
          </select>
        </div>
      </div>
      <div className="bg-bg-raised rounded-lg p-3 space-y-2">
        <div className="text-[10px] text-fg-muted font-medium">Extra Settings</div>
        <ToggleField label="Keep-Alive" value={form.xhttpKeepAlive || true}
          onChange={(v) => update('xhttpKeepAlive', v)} />
        <Field label="Max Concurrent Uploads" value={form.xhttpMaxConcurrent || 16}
          onChange={(v) => update('xhttpMaxConcurrent', +v)} type="number" />
      </div>
    </Section>
  );
}

// ──── mKCP ────

function KcpSettings({ form, update }: TransportTabProps) {
  return (
    <Section title="mKCP Settings">
      <div>
        <label className={labelCls}>Header Type</label>
        <select className={inputCls} value={form.kcpHeaderType || 'none'}
          onChange={(e) => update('kcpHeaderType', e.target.value)}>
          {KCP_HEADERS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seed (obfuscation)" value={form.kcpSeed || ''}
          onChange={(v) => update('kcpSeed', v)} placeholder="Optional seed" />
        <ToggleField label="Congestion Control" value={form.kcpCongestion || false}
          onChange={(v) => update('kcpCongestion', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Uplink Capacity (MB)" value={form.kcpUplinkCapacity || 100}
          onChange={(v) => update('kcpUplinkCapacity', +v)} type="number" />
        <Field label="Downlink Capacity (MB)" value={form.kcpDownlinkCapacity || 100}
          onChange={(v) => update('kcpDownlinkCapacity', +v)} type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Read Buffer (MB)" value={form.kcpReadBuffer || 1}
          onChange={(v) => update('kcpReadBuffer', +v)} type="number" />
        <Field label="Write Buffer (MB)" value={form.kcpWriteBuffer || 1}
          onChange={(v) => update('kcpWriteBuffer', +v)} type="number" />
      </div>
    </Section>
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

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} type={type} value={value}
        onChange={(e) => onChange(type === 'number' ? +e.target.value : e.target.value)}
        placeholder={placeholder} />
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

function TagInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [input, setInput] = useState('');
  const tags = value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const addTag = () => {
    if (input.trim() && !tags.includes(input.trim())) {
      onChange([...tags, input.trim()].join(', '));
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag).join(', '));
  };

  return (
    <div>
      {label && <label className={labelCls}>{label}</label>}
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded bg-bg-raised text-[10px] text-fg-muted">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-fg-subtle hover:text-red-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input className={cn(inputCls, "flex-1")} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder} />
        <button onClick={addTag}
          className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-fg text-[11px]">+</button>
      </div>
    </div>
  );
}
