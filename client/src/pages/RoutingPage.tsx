import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routingApi, RoutingRule } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import {
  Route, Plus, Search, Loader2, X, Trash2, Settings,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  RefreshCw, Zap
} from 'lucide-react';

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

const OUTBOUND_TAGS = ['proxy', 'direct', 'block'] as const;

const PRESETS = [
  {
    label: 'Block Ads',
    rule: { name: 'Block Ads', type: 'field' as const, domain: ['geosite:category-ads-all'], outboundTag: 'block', description: 'Block ad domains via geosite' }
  },
  {
    label: 'Block Bittorrent',
    rule: { name: 'Block Bittorrent', type: 'field' as const, protocol: ['bittorrent'], outboundTag: 'block', description: 'Block BitTorrent traffic' }
  },
  {
    label: 'Bypass Private IPs',
    rule: { name: 'Bypass Private IPs', type: 'field' as const, ip: ['geoip:private'], outboundTag: 'direct', description: 'Direct connect to private/lan IPs' }
  },
  {
    label: 'Proxy All',
    rule: { name: 'Proxy All', type: 'field' as const, outboundTag: 'proxy', description: 'Proxy all traffic' }
  },
  {
    label: 'Direct CN',
    rule: { name: 'Direct CN', type: 'field' as const, ip: ['geoip:cn'], outboundTag: 'direct', description: 'Direct connect to China IPs' }
  },
  {
    label: 'Block Telegram',
    rule: { name: 'Block Telegram', type: 'field' as const, domain: ['geosite:telegram'], outboundTag: 'block', description: 'Block Telegram domains' }
  },
];

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

function outboundColor(tag: string): string {
  const map: Record<string, string> = {
    proxy: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    direct: 'bg-green-500/15 text-green-400 border-green-500/20',
    block: 'bg-red-500/15 text-red-400 border-red-500/20',
  };
  return map[tag] || 'bg-fg-subtle/15 text-fg-muted border-fg-subtle/20';
}

// ══════════════════════════════════════════════
// Shared Components
// ══════════════════════════════════════════════

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

function Modal({ onClose, title, maxW = 'max-w-lg', children }: {
  onClose: () => void; title: string; maxW?: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={cn("bg-surface border border-border rounded-xl w-full shadow-xl max-h-[85vh] flex flex-col", maxW)}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-raised text-fg-muted"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} type={type} value={value} onChange={(e) => onChange(type === 'number' ? +e.target.value : e.target.value)}
        placeholder={placeholder} />
    </div>
  );
}

function TagArrayField({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState('');

  const addItem = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  const removeItem = (item: string) => {
    onChange(value.filter((v) => v !== item));
  };

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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder={placeholder} />
        <button onClick={addItem}
          className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-fg text-[11px]">+</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function RoutingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [outboundFilter, setOutboundFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<RoutingRule | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const { data: rules, isLoading, isFetching } = useQuery({
    queryKey: ['routing'],
    queryFn: () => routingApi.getAll().then((r) => r.data),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => routingApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => routingApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });

  const reorderMut = useMutation({
    mutationFn: (data: { rules: Array<{ id: string; priority: number }> }) => routingApi.reorder(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });

  const filtered = useMemo(() => rules?.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (outboundFilter && r.outboundTag !== outboundFilter) return false;
    if (statusFilter === 'enabled' && !r.enabled) return false;
    if (statusFilter === 'disabled' && r.enabled) return false;
    return true;
  }).sort((a, b) => a.priority - b.priority) || [], [rules, search, outboundFilter, statusFilter]);

  const totalEnabled = rules?.filter((r) => r.enabled).length || 0;

  const moveRule = (id: string, direction: 'up' | 'down') => {
    if (!rules) return;
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const updated = sorted.map((r, i) => ({
      id: r.id,
      priority: i === idx ? sorted[swapIdx].priority : i === swapIdx ? sorted[idx].priority : r.priority,
    }));
    reorderMut.mutate({ rules: updated });
  };

  const applyPreset = (preset: typeof PRESETS[0]['rule']) => {
    const maxPriority = rules ? Math.max(...rules.map((r) => r.priority), 0) + 1 : 1;
    routingApi.create({ ...preset, priority: maxPriority, enabled: true }).then(() => {
      qc.invalidateQueries({ queryKey: ['routing'] });
      setShowPresets(false);
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Route size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">{t('routing.title')}</h1>
            <p className="text-xs text-fg-subtle">{totalEnabled} {t('common.active')} · {rules?.length || 0} {t('common.total')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 size={14} className="animate-spin text-fg-subtle" />}
          <button onClick={() => qc.invalidateQueries({ queryKey: ['routing'] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-raised hover:bg-bg-sunken text-fg-muted text-xs transition-colors">
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          <button onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-raised hover:bg-bg-sunken text-fg-muted text-xs transition-colors">
            <Zap size={13} /> {t('routing.presets')}
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors">
            <Plus size={14} /> {t('routing.addRule')}
          </button>
        </div>
      </div>

      {/* Presets Panel */}
      {showPresets && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-fg-muted">{t('routing.quickAddPresets')}</span>
            <button onClick={() => setShowPresets(false)} className="text-fg-subtle hover:text-fg-muted"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PRESETS.map((preset, i) => (
              <button key={i} onClick={() => applyPreset(preset.rule)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-raised hover:bg-bg-sunken border border-border text-xs text-fg-muted transition-colors text-left">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border", outboundColor(preset.rule.outboundTag))}>
                  {preset.rule.outboundTag}
                </span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input type="text" placeholder={t('routing.searchPlaceholder')}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent/0.3))]" />
        </div>
        <select value={outboundFilter} onChange={(e) => setOutboundFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none appearance-none cursor-pointer">
          <option value="">{t('routing.allOutbounds')}</option>
          {OUTBOUND_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none appearance-none cursor-pointer">
          <option value="">{t('common.allStatus')}</option>
          <option value="enabled">{t('common.enabled')}</option>
          <option value="disabled">{t('common.disabled')}</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyRouting onAdd={() => setShowCreate(true)} />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider">
                  <th className="w-12 px-3 py-2.5 font-medium text-fg-subtle">#</th>
                  <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('routing.name')}</th>
                  <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('routing.type')}</th>
                  <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('routing.domains')}</th>
                  <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('routing.ip')}</th>
                  <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('routing.port')}</th>
                  <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('routing.protocol')}</th>
                  <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('routing.outbound')}</th>
                  <th className="text-center px-3 py-2.5 font-medium text-fg-subtle">{t('routing.enabled')}</th>
                  <th className="text-right px-3 py-2.5 font-medium text-fg-subtle">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map((rule) => (
                  <tr key={rule.id} className="hover:bg-bg-raised/20 transition-colors group">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[11px] text-fg-subtle w-5 text-center">{rule.priority}</span>
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveRule(rule.id, 'up')}
                            className="text-[8px] text-fg-muted hover:text-fg-muted"><ChevronUp size={10} /></button>
                          <button onClick={() => moveRule(rule.id, 'down')}
                            className="text-[8px] text-fg-muted hover:text-fg-muted"><ChevronDown size={10} /></button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-fg">{rule.name}</span>
                        {rule.description && (
                          <span className="text-[10px] text-fg-muted truncate max-w-[120px]">({rule.description})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-raised text-fg-muted">{rule.type}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[11px] text-fg-muted truncate max-w-[120px]">
                        {rule.domain && rule.domain.length > 0 ? (
                          <span className="text-blue-400">{rule.domain.slice(0, 2).join(', ')}{rule.domain.length > 2 ? ` +${rule.domain.length - 2}` : ''}</span>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[11px] text-fg-muted truncate max-w-[100px]">
                        {rule.ip && rule.ip.length > 0 ? (
                          <span className="text-green-400">{rule.ip.slice(0, 2).join(', ')}{rule.ip.length > 2 ? ` +${rule.ip.length - 2}` : ''}</span>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] text-fg-muted">{rule.port || '—'}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[11px] text-fg-muted truncate max-w-[80px]">
                        {rule.protocol && rule.protocol.length > 0 ? (
                          rule.protocol.slice(0, 2).join(', ') + (rule.protocol.length > 2 ? ` +${rule.protocol.length - 2}` : '')
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border", outboundColor(rule.outboundTag))}>
                        {rule.outboundTag}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center">
                        <button onClick={() => toggleMut.mutate(rule.id)}
                          className="p-1 rounded hover:bg-bg-raised transition-colors">
                          {rule.enabled ?
                            <ToggleRight size={18} className="text-green-400" /> :
                            <ToggleLeft size={18} className="text-fg-muted" />
                          }
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditRule(rule)}
                          className="p-1 rounded hover:bg-bg-raised text-fg-subtle hover:text-fg-muted" title={t('common.edit')}>
                          <Settings size={13} />
                        </button>
                        <button onClick={() => { if (confirm(t('routing.deleteConfirm', { name: rule.name }))) deleteMut.mutate(rule.id); }}
                          className="p-1 rounded hover:bg-red-500/10 text-fg-subtle hover:text-red-400" title={t('common.delete')}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateRuleModal onClose={() => setShowCreate(false)} />}
      {editRule && <EditRuleModal rule={editRule} onClose={() => setEditRule(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════
// Create Rule Modal
// ══════════════════════════════════════════════

function CreateRuleModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'field' | 'logical'>('field');
  const [domain, setDomain] = useState<string[]>([]);
  const [ip, setIp] = useState<string[]>([]);
  const [port, setPort] = useState('');
  const [sourcePort, setSourcePort] = useState('');
  const [source, setSource] = useState<string[]>([]);
  const [protocol, setProtocol] = useState<string[]>([]);
  const [inboundTag, setInboundTag] = useState<string[]>([]);
  const [outboundTag, setOutboundTag] = useState('direct');
  const [balancerTag, setBalancerTag] = useState('');
  const [nodeScope, setNodeScope] = useState('');

  const { data: rules } = useQuery({
    queryKey: ['routing'],
    queryFn: () => routingApi.getAll().then((r) => r.data),
  });

  const maxPriority = rules ? Math.max(...rules.map((r) => r.priority), 0) + 1 : 1;

  const mutation = useMutation({
    mutationFn: () => routingApi.create({
      name,
      description: description || undefined,
      enabled: true,
      priority: maxPriority,
      type,
      domain: domain.length > 0 ? domain : undefined,
      ip: ip.length > 0 ? ip : undefined,
      port: port || undefined,
      sourcePort: sourcePort || undefined,
      source: source.length > 0 ? source : undefined,
      protocol: protocol.length > 0 ? protocol : undefined,
      inboundTag: inboundTag.length > 0 ? inboundTag : undefined,
      outboundTag,
      balancerTag: balancerTag || undefined,
      nodeScope: nodeScope || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routing'] }); onClose(); },
  });

  return (
    <Modal onClose={onClose} title={t('routing.createRule')} maxW="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('routing.name')} *`} value={name} onChange={setName} placeholder="My Rule" />
          <Field label={t('routing.description')} value={description} onChange={setDescription} placeholder="Optional description" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('routing.type')}</label>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="field">Field (single rule)</option>
              <option value="logical">Logical (AND/OR composite)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('routing.outbound')} *</label>
            <select className={inputCls} value={outboundTag} onChange={(e) => setOutboundTag(e.target.value)}>
              {OUTBOUND_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
        </div>

        <TagArrayField label={t('routing.domains')} value={domain} onChange={setDomain}
          placeholder="geosite:google, *.example.com" />

        <TagArrayField label={t('routing.ip')} value={ip} onChange={setIp}
          placeholder="geoip:private, 10.0.0.0/8" />

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('routing.port')} value={port} onChange={setPort} placeholder="80,443 or 80-443" />
          <Field label={t('routing.sourcePort')} value={sourcePort} onChange={setSourcePort} placeholder="53" />
        </div>

        <TagArrayField label={t('routing.protocol')} value={protocol} onChange={setProtocol}
          placeholder="http, tls, bittorrent" />

        <TagArrayField label={t('routing.inboundTag')} value={inboundTag} onChange={setInboundTag}
          placeholder="vless-inbound" />

        <TagArrayField label={t('routing.source')} value={source} onChange={setSource}
          placeholder="192.168.1.0/24" />

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('routing.balancerTag')} value={balancerTag} onChange={setBalancerTag} placeholder="Optional" />
          <Field label={t('routing.nodeScope')} value={nodeScope} onChange={setNodeScope} placeholder="Optional" />
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-border mt-4">
        <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg bg-bg-raised text-fg-muted text-xs">{t('common.cancel')}</button>
        <button onClick={() => mutation.mutate()}
          disabled={!name || !outboundTag || mutation.isPending}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> {t('common.creating')}</> : t('routing.createRule')}
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════
// Edit Rule Modal
// ══════════════════════════════════════════════

function EditRuleModal({ rule, onClose }: { rule: RoutingRule; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: rule.name,
    description: rule.description || '',
    type: rule.type,
    domain: rule.domain || [],
    ip: rule.ip || [],
    port: rule.port || '',
    sourcePort: rule.sourcePort || '',
    source: rule.source || [],
    protocol: rule.protocol || [],
    inboundTag: rule.inboundTag || [],
    outboundTag: rule.outboundTag,
    balancerTag: rule.balancerTag || '',
    nodeScope: rule.nodeScope || '',
  });

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => routingApi.update(rule.id, {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      domain: form.domain.length > 0 ? form.domain : undefined,
      ip: form.ip.length > 0 ? form.ip : undefined,
      port: form.port || undefined,
      sourcePort: form.sourcePort || undefined,
      source: form.source.length > 0 ? form.source : undefined,
      protocol: form.protocol.length > 0 ? form.protocol : undefined,
      inboundTag: form.inboundTag.length > 0 ? form.inboundTag : undefined,
      outboundTag: form.outboundTag,
      balancerTag: form.balancerTag || undefined,
      nodeScope: form.nodeScope || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routing'] }); onClose(); },
  });

  return (
    <Modal onClose={onClose} title={`${t('routing.editRule')} ${rule.name}`} maxW="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('routing.name')} *`} value={form.name} onChange={(v) => update('name', v)} />
          <Field label={t('routing.description')} value={form.description} onChange={(v) => update('description', v)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('routing.type')}</label>
            <select className={inputCls} value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="field">Field (single rule)</option>
              <option value="logical">Logical (AND/OR composite)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('routing.outbound')} *</label>
            <select className={inputCls} value={form.outboundTag} onChange={(e) => update('outboundTag', e.target.value)}>
              {OUTBOUND_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
        </div>

        <TagArrayField label={t('routing.domains')} value={form.domain} onChange={(v) => update('domain', v)}
          placeholder="geosite:google, *.example.com" />

        <TagArrayField label={t('routing.ip')} value={form.ip} onChange={(v) => update('ip', v)}
          placeholder="geoip:private, 10.0.0.0/8" />

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('routing.port')} value={form.port} onChange={(v) => update('port', v)} placeholder="80,443 or 80-443" />
          <Field label={t('routing.sourcePort')} value={form.sourcePort} onChange={(v) => update('sourcePort', v)} placeholder="53" />
        </div>

        <TagArrayField label={t('routing.protocol')} value={form.protocol} onChange={(v) => update('protocol', v)}
          placeholder="http, tls, bittorrent" />

        <TagArrayField label={t('routing.inboundTag')} value={form.inboundTag} onChange={(v) => update('inboundTag', v)}
          placeholder="vless-inbound" />

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('routing.balancerTag')} value={form.balancerTag} onChange={(v) => update('balancerTag', v)} placeholder="Optional" />
          <Field label={t('routing.nodeScope')} value={form.nodeScope} onChange={(v) => update('nodeScope', v)} placeholder="Optional" />
        </div>

        {/* Priority */}
        <div>
          <label className={labelCls}>{t('routing.priority')}</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-muted">{rule.priority}</span>
            <span className="text-[10px] text-fg-muted">({t('routing.priorityManaged')})</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-border mt-4">
        <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg bg-bg-raised text-fg-muted text-xs">{t('common.cancel')}</button>
        <button onClick={() => mutation.mutate()}
          disabled={!form.name || !form.outboundTag || mutation.isPending}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> {t('common.saving')}</> : t('common.save')}
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════
// Empty State
// ══════════════════════════════════════════════

function EmptyRouting({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <div className="bg-surface border border-border rounded-xl p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-xl bg-bg-raised flex items-center justify-center mb-4">
        <Route size={24} className="text-fg-muted" />
      </div>
      <h3 className="text-sm font-medium text-fg-muted">{t('routing.noRules')}</h3>
      <p className="text-xs text-fg-muted mt-1 mb-4 max-w-xs mx-auto">{t('routing.noRulesDesc')}</p>
      <button onClick={onAdd} className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium">{t('routing.addRule')}</button>
    </div>
  );
}