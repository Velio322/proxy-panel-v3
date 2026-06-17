import { useState } from 'react';
import { cn } from '@/lib/utils';

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

export interface RoutingRuleForm {
  id: string;
  type: 'field' | 'logical';
  logicalMode?: 'and' | 'or';
  domain: string[];
  domainMatcher: 'linear' | 'mph';
  ip: string[];
  port: string;
  sourcePort: string;
  source: string[];
  inboundTag: string[];
  protocol: string[];
  outboundTag: string;
  balancerTag?: string;
  network: string;
  email: string;
  enable: boolean;
  remark: string;
}

interface RoutingRulesTabProps {
  rules: RoutingRuleForm[];
  onChange: (rules: RoutingRuleForm[]) => void;
  outbounds: string[];
  inboundTags: string[];
}

// ══════════════════════════════════════════════
// Presets
// ══════════════════════════════════════════════

const PRESETS: { label: string; icon: string; rule: Partial<RoutingRuleForm> }[] = [
  {
    label: 'Block BitTorrent',
    icon: '🚫',
    rule: {
      type: 'field', protocol: ['bittorrent'], outboundTag: 'block',
      remark: 'Block BitTorrent traffic',
    },
  },
  {
    label: 'Block Private IPs',
    icon: '🔒',
    rule: {
      type: 'field', ip: ['geoip:private'], outboundTag: 'block',
      remark: 'Block private/lan IPs',
    },
  },
  {
    label: 'Block Ads (geosite)',
    icon: '📢',
    rule: {
      type: 'field', domain: ['geosite:category-ads-all'], outboundTag: 'block',
      remark: 'Block ad domains via geosite',
    },
  },
  {
    label: 'Block Malware (geosite)',
    icon: '🦠',
    rule: {
      type: 'field', domain: ['geosite:category-malware'], outboundTag: 'block',
      remark: 'Block malware domains',
    },
  },
  {
    label: 'Block Chinese IPs',
    icon: '🇨🇳',
    rule: {
      type: 'field', ip: ['geoip:cn'], outboundTag: 'block',
      remark: 'Block China GeoIP',
    },
  },
  {
    label: 'Block Russian IPs',
    icon: '🇷🇺',
    rule: {
      type: 'field', ip: ['geoip:ru'], outboundTag: 'block',
      remark: 'Block Russia GeoIP',
    },
  },
  {
    label: 'Block Telegram (geoip)',
    icon: '✈️',
    rule: {
      type: 'field', domain: ['geosite:telegram'], outboundTag: 'block',
      remark: 'Block Telegram domains',
    },
  },
  {
    label: 'Direct Local Domains',
    icon: '🏠',
    rule: {
      type: 'field', domain: ['geosite:private', 'localhost'], outboundTag: 'direct',
      remark: 'Direct connect to local/private domains',
    },
  },
  {
    label: 'DNS to DNS-out',
    icon: '🌐',
    rule: {
      type: 'field', protocol: ['dns'], outboundTag: 'dns-out',
      remark: 'Route DNS queries to DNS outbound',
    },
  },
];

const PROTOCOL_OPTIONS = ['http', 'tls', 'quic', 'stun', 'dns', 'bittorrent'];
const NETWORK_OPTIONS = ['tcp', 'udp', 'tcp,udp'];
const GEOIP_OPTIONS = ['cn', 'ru', 'ir', 'pk', 'private', 'geoip:private', 'geoip:!private'];
const GEOSITE_OPTIONS = [
  'geosite:category-ads-all', 'geosite:category-malware', 'geosite:category-phishing',
  'geosite:telegram', 'geosite:google', 'geosite:netflix', 'geosite:youtube',
  'geosite:facebook', 'geosite:twitter', 'geosite:geolocation-!cn',
  'geosite:private', 'geosite:localhost',
];

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function RoutingRulesTab({ rules, onChange, outbounds, inboundTags }: RoutingRulesTabProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [_dragIdx, _setDragIdx] = useState<number | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const addRule = (preset?: Partial<RoutingRuleForm>) => {
    const newRule: RoutingRuleForm = {
      id: `rule-${Date.now()}`,
      type: preset?.type || 'field',
      domain: preset?.domain || [],
      domainMatcher: 'linear',
      ip: preset?.ip || [],
      port: preset?.port || '',
      sourcePort: '',
      source: [],
      inboundTag: preset?.inboundTag || [],
      protocol: preset?.protocol || [],
      outboundTag: preset?.outboundTag || 'direct',
      network: preset?.network || '',
      email: '',
      enable: true,
      remark: preset?.remark || '',
      ...preset,
    };
    onChange([...rules, newRule]);
    setEditingIdx(rules.length);
  };

  const updateRule = (idx: number, key: keyof RoutingRuleForm, value: any) => {
    const updated = [...rules];
    updated[idx] = { ...updated[idx], [key]: value };
    onChange(updated);
  };

  const removeRule = (idx: number) => {
    onChange(rules.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const duplicateRule = (idx: number) => {
    const dup = { ...rules[idx], id: `rule-${Date.now()}`, remark: `${rules[idx].remark} (copy)` };
    onChange([...rules.slice(0, idx + 1), dup, ...rules.slice(idx + 1)]);
  };

  const moveRule = (from: number, to: number) => {
    if (to < 0 || to >= rules.length) return;
    const updated = [...rules];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    onChange(updated);
    setEditingIdx(to);
  };

  const toggleRule = (idx: number) => {
    updateRule(idx, 'enable', !rules[idx].enable);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fg">Routing Rules</h3>
          <p className="text-[10px] text-fg-subtle">{rules.length} rules · {rules.filter((r) => r.enable).length} active</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPresets(!showPresets)}
            className="px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-[11px] text-fg-muted hover:text-fg transition-colors">
            ⚡ Presets
          </button>
          <button onClick={() => addRule()}
            className="px-3 py-1.5 rounded-lg bg-[hsl(var(--accent))] text-white text-[11px] font-medium hover:bg-purple-500 transition-colors">
            + Add Rule
          </button>
        </div>
      </div>

      {/* Presets */}
      {showPresets && (
        <div className="bg-bg-raised border border-border rounded-xl p-3">
          <div className="text-[10px] text-fg-subtle mb-2">Quick Add — click to create a rule</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset, i) => (
              <button key={i} onClick={() => { addRule(preset.rule); setShowPresets(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-raised hover:bg-bg-sunken border border-border text-[10px] text-fg-muted transition-colors">
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rules Table */}
      {rules.length === 0 ? (
        <div className="bg-bg-raised/20 rounded-xl border border-dashed border-border p-8 text-center">
          <div className="text-lg mb-2">📋</div>
          <div className="text-xs text-fg-subtle">No routing rules</div>
          <div className="text-[10px] text-fg-muted mt-1">Add rules to control traffic routing</div>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table Header */}
          <div className="grid grid-cols-[30px_40px_1fr_1fr_1fr_120px_60px] gap-2 px-3 py-1.5 text-[10px] text-fg-muted uppercase tracking-wider">
            <span>Ord</span>
            <span>On</span>
            <span>Domain / IP</span>
            <span>Protocol</span>
            <span>Outbound</span>
            <span>Remark</span>
            <span></span>
          </div>

          {/* Rules */}
          {rules.map((rule, idx) => (
            <div key={rule.id}
              className={cn(
                "group grid grid-cols-[30px_40px_1fr_1fr_1fr_120px_60px] gap-2 items-center px-3 py-2 rounded-lg transition-all cursor-pointer",
                editingIdx === idx ? "bg-purple-500/5 border border-[hsl(var(--accent/0.2))]" :
                rule.enable ? "bg-bg-raised hover:bg-bg-raised/50 border border-transparent" :
                "bg-bg-raised/10 border border-transparent opacity-50"
              )}
              onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}>

              {/* Order + Drag */}
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-fg-muted w-4 text-center">{idx + 1}</span>
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); moveRule(idx, idx - 1); }}
                    className="text-[8px] text-fg-muted hover:text-fg-muted">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); moveRule(idx, idx + 1); }}
                    className="text-[8px] text-fg-muted hover:text-fg-muted">▼</button>
                </div>
              </div>

              {/* Toggle */}
              <button onClick={(e) => { e.stopPropagation(); toggleRule(idx); }}
                className={cn("w-7 h-4 rounded-full transition-colors",
                  rule.enable ? "bg-[hsl(var(--accent))]" : "bg-bg-sunken")}>
                <div className={cn("w-3 h-3 rounded-full bg-surface shadow transition-transform mx-0.5",
                  rule.enable ? "translate-x-3" : "translate-x-0")} />
              </button>

              {/* Domain / IP */}
              <div className="text-[11px] text-fg-muted truncate">
                {rule.domain.length > 0 && (
                  <span className="text-blue-400">{rule.domain.slice(0, 2).join(', ')}{rule.domain.length > 2 ? ` +${rule.domain.length - 2}` : ''}</span>
                )}
                {rule.domain.length > 0 && rule.ip.length > 0 && <span className="text-fg-muted mx-1">·</span>}
                {rule.ip.length > 0 && (
                  <span className="text-green-400">{rule.ip.slice(0, 2).join(', ')}{rule.ip.length > 2 ? ` +${rule.ip.length - 2}` : ''}</span>
                )}
                {rule.domain.length === 0 && rule.ip.length === 0 && <span className="text-fg-muted">—</span>}
              </div>

              {/* Protocol */}
              <div className="text-[11px] text-fg-muted truncate">
                {rule.protocol.length > 0 ? rule.protocol.join(', ') : <span className="text-fg-muted">—</span>}
              </div>

              {/* Outbound */}
              <div className="text-[11px]">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                  rule.outboundTag === 'block' ? "bg-red-500/10 text-red-400" :
                  rule.outboundTag === 'direct' ? "bg-green-500/10 text-green-400" :
                  "bg-blue-500/10 text-blue-400"
                )}>{rule.outboundTag}</span>
              </div>

              {/* Remark */}
              <span className="text-[10px] text-fg-muted truncate">{rule.remark}</span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); duplicateRule(idx); }}
                  className="p-1 rounded hover:bg-bg-sunken text-fg-subtle hover:text-fg-muted text-[10px]">⧉</button>
                <button onClick={(e) => { e.stopPropagation(); removeRule(idx); }}
                  className="p-1 rounded hover:bg-red-500/10 text-fg-subtle hover:text-red-400 text-[10px]">×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Panel */}
      {editingIdx !== null && rules[editingIdx] && (
        <RuleEditPanel
          rule={rules[editingIdx]}
          outbounds={outbounds}
          inboundTags={inboundTags}
          onChange={(key, val) => updateRule(editingIdx, key, val)}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Rule Edit Panel
// ══════════════════════════════════════════════

function RuleEditPanel({ rule, outbounds, inboundTags, onChange, onClose }: {
  rule: RoutingRuleForm;
  outbounds: string[];
  inboundTags: string[];
  onChange: (key: keyof RoutingRuleForm, val: any) => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-bg-raised/50 border border-[hsl(var(--accent/0.2))] rounded-xl p-4 space-y-3 animate-in">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[hsl(var(--accent))]">Edit Rule: {rule.remark || rule.id}</h4>
        <button onClick={onClose} className="text-fg-subtle hover:text-fg-muted text-[11px]">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={rule.type} onChange={(e) => onChange('type', e.target.value)}>
            <option value="field">Field (single rule)</option>
            <option value="logical">Logical (AND/OR composite)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Outbound *</label>
          <select className={inputCls} value={rule.outboundTag} onChange={(e) => onChange('outboundTag', e.target.value)}>
            {outbounds.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <TagArrayField label="Domains" value={rule.domain} onChange={(v) => onChange('domain', v)}
        placeholder="geosite:google, *.example.com" suggestions={GEOSITE_OPTIONS} />

      <TagArrayField label="IP / GeoIP" value={rule.ip} onChange={(v) => onChange('ip', v)}
        placeholder="geoip:private, 10.0.0.0/8" suggestions={GEOIP_OPTIONS} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Port (e.g., 80,443 or 80-443)</label>
          <input className={inputCls} value={rule.port} onChange={(e) => onChange('port', e.target.value)}
            placeholder="80,443" />
        </div>
        <div>
          <label className={labelCls}>Network</label>
          <select className={inputCls} value={rule.network} onChange={(e) => onChange('network', e.target.value)}>
            <option value="">Any</option>
            {NETWORK_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <TagArrayField label="Protocols" value={rule.protocol} onChange={(v) => onChange('protocol', v)}
        placeholder="http, tls, bittorrent" suggestions={PROTOCOL_OPTIONS} />

      {rule.type === 'logical' && (
        <div>
          <label className={labelCls}>Logical Mode</label>
          <select className={inputCls} value={rule.logicalMode || 'or'} onChange={(e) => onChange('logicalMode', e.target.value)}>
            <option value="and">AND (all conditions must match)</option>
            <option value="or">OR (any condition matches)</option>
          </select>
        </div>
      )}

      <TagArrayField label="Inbound Tags" value={rule.inboundTag} onChange={(v) => onChange('inboundTag', v)}
        placeholder="vless-inbound" suggestions={inboundTags} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Source Port</label>
          <input className={inputCls} value={rule.sourcePort} onChange={(e) => onChange('sourcePort', e.target.value)}
            placeholder="53" />
        </div>
        <div>
          <label className={labelCls}>Remark</label>
          <input className={inputCls} value={rule.remark} onChange={(e) => onChange('remark', e.target.value)}
            placeholder="Description" />
        </div>
      </div>

      {/* JSON Preview */}
      <div>
        <label className={labelCls}>Generated Xray Rule (JSON)</label>
        <pre className="bg-surface rounded-lg p-2 text-[10px] text-fg-muted font-mono overflow-x-auto max-h-24">
          {JSON.stringify({
            type: rule.type,
            ...(rule.domain.length && { domain: rule.domain }),
            ...(rule.ip.length && { ip: rule.ip }),
            ...(rule.port && { port: rule.port }),
            ...(rule.protocol.length && { protocol: rule.protocol }),
            ...(rule.inboundTag.length && { inboundTag: rule.inboundTag }),
            outboundTag: rule.outboundTag,
            ...(rule.network && { network: rule.network }),
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Tag Array Field
// ══════════════════════════════════════════════

function TagArrayField({ label, value, onChange, placeholder, suggestions }: {
  label: string; value: string[]; onChange: (v: string[]) => void;
  placeholder: string; suggestions?: string[];
}) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addItem = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeItem = (item: string) => {
    onChange(value.filter((v) => v !== item));
  };

  const filteredSuggestions = suggestions?.filter((s) =>
    !value.includes(s) && (!input || s.toLowerCase().includes(input.toLowerCase()))
  ) || [];

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((item) => (
          <span key={item} className="flex items-center gap-1 px-2 py-0.5 rounded bg-bg-raised text-[10px] text-fg-muted border border-border">
            <span className="text-blue-400 font-mono">{item}</span>
            <button onClick={() => removeItem(item)} className="text-fg-subtle hover:text-red-400 ml-0.5">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input className={cn(inputCls, "flex-1")} value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(input); } }}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder} />
        <button onClick={() => addItem(input)}
          className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-fg text-[11px]">+</button>
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {filteredSuggestions.slice(0, 8).map((s) => (
            <button key={s} onClick={() => addItem(s)}
              className="px-2 py-0.5 rounded bg-bg-raised/50 text-[9px] text-fg-subtle hover:text-fg-muted hover:bg-bg-sunken transition-colors border border-border">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
