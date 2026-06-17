import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, Plan } from '@/lib/api';
import { formatBytes, cn } from '@/lib/utils';
import {
  CreditCard, Loader2, Plus, X, Trash2, Edit3, Users,
  Clock, HardDrive, MoreVertical, ToggleLeft, ToggleRight
} from 'lucide-react';
import { useI18n } from '@/i18n';

const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC'];

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function PlansPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [typeFilter, setTypeFilter] = useState('');

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.getAll().then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: (plan: Plan) => plansApi.update(plan.id, { active: !plan.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  });

  const filtered = (plans || []).filter((p) => !typeFilter || p.type === typeFilter);
  const userPlans = filtered.filter((p) => p.type === 'USER');
  const resellerPlans = filtered.filter((p) => p.type === 'RESELLER');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <CreditCard size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">{t('plans.title')}</h1>
            <p className="text-xs text-fg-subtle">{plans?.length || 0} {t('plans.title').toLowerCase()} · {userPlans.length} {t('plans.userPlans').toLowerCase()} · {resellerPlans.length} {t('plans.resellerPlans').toLowerCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none appearance-none cursor-pointer">
            <option value="">{t('plans.allTypes')}</option>
            <option value="USER">{t('plans.userPlans')}</option>
            <option value="RESELLER">{t('plans.resellerPlans')}</option>
          </select>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>
            <Plus size={14} /> {t('plans.addPlan')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : filtered.length === 0 ? (
        <EmptyPlans onAdd={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-6">
          {userPlans.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">{t('plans.userPlans')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {userPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan}
                    onEdit={() => setEditPlan(plan)}
                    onToggle={() => toggleActive.mutate(plan)}
                    onDelete={() => { if (confirm(`Delete "${plan.name}"?`)) deletePlan.mutate(plan.id); }} />
                ))}
              </div>
            </div>
          )}
          {resellerPlans.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">{t('plans.resellerPlans')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {resellerPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan}
                    onEdit={() => setEditPlan(plan)}
                    onToggle={() => toggleActive.mutate(plan)}
                    onDelete={() => { if (confirm(`Delete "${plan.name}"?`)) deletePlan.mutate(plan.id); }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && <PlanModal onClose={() => setShowCreate(false)} />}
      {editPlan && <PlanModal plan={editPlan} onClose={() => setEditPlan(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════
// Plan Card
// ══════════════════════════════════════════════

function PlanCard({ plan, onEdit, onToggle, onDelete }: {
  plan: Plan; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const protocols = (plan.protocols as string[]) || [];
  const subs = plan._count?.subscriptions || 0;

  const protocolColor = (p: string) => {
    const map: Record<string, string> = {
      VLESS: 'text-blue-400', HYSTERIA2: 'text-orange-400', NAIVEPROXY: 'text-green-400',
      MIERU: 'text-[hsl(var(--accent))]', TROJAN: 'text-red-400', VMESS: 'text-cyan-400',
    };
    return map[p] || 'text-fg-muted';
  };

  return (
    <div className={cn("bg-surface border rounded-xl p-4 transition-all group",
      plan.active ? "border-border hover:border-border" : "border-border opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-fg">{plan.name}</h3>
            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium",
              plan.type === 'USER' ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
            )}>{plan.type}</span>
          </div>
          {plan.description && <p className="text-[11px] text-fg-subtle mt-0.5">{plan.description}</p>}
        </div>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="p-1 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg-muted">
            <MoreVertical size={14} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-32 bg-bg-raised border border-border rounded-lg shadow-xl z-20 py-1">
                <button onClick={() => { onEdit(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-[11px] text-fg-muted hover:bg-bg-sunken flex items-center gap-2">
                  <Edit3 size={11} /> {t('common.edit')}
                </button>
                <button onClick={() => { onToggle(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-[11px] text-fg-muted hover:bg-bg-sunken flex items-center gap-2">
                  {plan.active ? <ToggleLeft size={11} /> : <ToggleRight size={11} />} {plan.active ? t('common.deactivate') : t('common.activate')}
                </button>
                <div className="border-t border-border my-0.5" />
                <button onClick={() => { onDelete(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-bg-sunken flex items-center gap-2">
                  <Trash2 size={11} /> {t('common.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-2xl font-bold text-fg">${plan.price}</span>
        <span className="text-xs text-fg-subtle">{plan.currency} / {plan.duration}d</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-bg-raised rounded-lg px-2 py-1.5 text-center">
          <HardDrive size={12} className="mx-auto text-fg-muted mb-0.5" />
          <div className="text-[11px] font-medium text-fg-muted">{plan.trafficLimit > 0 ? formatBytes(plan.trafficLimit) : '∞'}</div>
          <div className="text-[9px] text-fg-muted">{t('plans.traffic')}</div>
        </div>
        <div className="bg-bg-raised rounded-lg px-2 py-1.5 text-center">
          <Clock size={12} className="mx-auto text-fg-muted mb-0.5" />
          <div className="text-[11px] font-medium text-fg-muted">{plan.duration}d</div>
          <div className="text-[9px] text-fg-muted">{t('plans.duration')}</div>
        </div>
        <div className="bg-bg-raised rounded-lg px-2 py-1.5 text-center">
          <Users size={12} className="mx-auto text-fg-muted mb-0.5" />
          <div className="text-[11px] font-medium text-fg-muted">{subs}</div>
          <div className="text-[9px] text-fg-muted">{t('plans.subs')}</div>
        </div>
      </div>

      {/* Protocols */}
      <div className="flex flex-wrap gap-1 mb-3">
        {protocols.map((p) => (
          <span key={p} className={cn("text-[10px] font-medium", protocolColor(p))}>• {p}</span>
        ))}
      </div>

      {/* Status */}
      <div className="pt-2 border-t border-border">
        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
          plan.active ? "bg-green-500/10 text-green-400" : "bg-bg-raised text-fg-subtle"
        )}>
          <span className={cn("w-1 h-1 rounded-full", plan.active ? "bg-green-400" : "bg-fg-subtle")} />
          {plan.active ? t('common.active') : t('common.inactive')}
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Plan Modal (Create/Edit)
// ══════════════════════════════════════════════

function PlanModal({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const isEdit = !!plan;

  const [form, setForm] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    type: plan?.type || 'USER',
    price: plan?.price || 0,
    currency: plan?.currency || 'USD',
    duration: plan?.duration || 30,
    trafficLimitGB: plan?.trafficLimit ? Math.round(Number(plan.trafficLimit) / 1073741824) : 100,
    maxClients: plan?.maxClients || 10,
    maxSpeed: plan?.maxSpeed || 0,
    protocols: (plan?.protocols as string[]) || ['VLESS', 'HYSTERIA2'],
    active: plan?.active ?? true,
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggleProto = (p: string) => {
    const protos = form.protocols.includes(p) ? form.protocols.filter((x) => x !== p) : [...form.protocols, p];
    update('protocols', protos);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        ...form,
        trafficLimit: form.trafficLimitGB * 1073741824,
      };
      return isEdit ? plansApi.update(plan!.id, data) : plansApi.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); onClose(); },
  });

  return (
    <Modal onClose={onClose} title={isEdit ? `${t('common.edit')} ${plan!.name}` : t('plans.createPlan')} maxW="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('plans.name')} *`} value={form.name} onChange={(v) => update('name', v)} placeholder="Premium Plan" />
          <div>
            <label className={labelCls}>{t('plans.type')} *</label>
            <select className={inputCls} value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="USER">{t('plans.userPlans')}</option>
              <option value="RESELLER">{t('plans.resellerPlans')}</option>
            </select>
          </div>
        </div>
        <Field label={t('plans.description')} value={form.description} onChange={(v) => update('description', v)} placeholder="30 days, 150GB traffic" />
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('plans.price')} value={form.price} onChange={(v) => update('price', +v)} type="number" />
          <div>
            <label className={labelCls}>{t('plans.currency')}</label>
            <select className={inputCls} value={form.currency} onChange={(e) => update('currency', e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
              <option value="CNY">CNY</option>
              <option value="IRR">IRR</option>
            </select>
          </div>
          <Field label={t('plans.durationDays')} value={form.duration} onChange={(v) => update('duration', +v)} type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('plans.trafficLimitGB')} value={form.trafficLimitGB} onChange={(v) => update('trafficLimitGB', +v)} type="number" />
          <Field label={t('plans.maxSpeedMbps')} value={form.maxSpeed} onChange={(v) => update('maxSpeed', +v)} type="number" />
        </div>

        <div>
          <label className={labelCls}>{t('plans.allowedProtocols')}</label>
          <div className="flex flex-wrap gap-1.5">
            {PROTOCOLS.map((p) => (
              <button key={p} onClick={() => toggleProto(p)}
                className={cn("px-2 py-1 rounded-lg text-[11px] font-medium border transition-all",
                  form.protocols.includes(p)
                    ? "border-[hsl(var(--accent/0.3))] bg-[hsl(var(--accent-light))] text-[hsl(var(--accent))]"
                    : "border-border text-fg-muted hover:text-fg-muted"
                )}>{p}</button>
            ))}
          </div>
        </div>

        {form.type === 'RESELLER' && (
          <Field label={t('plans.maxClients')} value={form.maxClients} onChange={(v) => update('maxClients', +v)} type="number" />
        )}

        <div className="bg-bg-raised rounded-lg p-3 text-[11px] space-y-1">
          <div className="text-fg-muted font-medium">{t('plans.summary')}</div>
          <div className="flex justify-between"><span className="text-fg-subtle">{t('plans.price')}</span><span className="text-fg">${form.price} {form.currency}</span></div>
          <div className="flex justify-between"><span className="text-fg-subtle">{t('plans.duration')}</span><span className="text-fg">{form.duration} {t('plans.days')}</span></div>
          <div className="flex justify-between"><span className="text-fg-subtle">{t('plans.traffic')}</span><span className="text-fg">{form.trafficLimitGB > 0 ? `${form.trafficLimitGB} GB` : t('plans.unlimited')}</span></div>
          <div className="flex justify-between"><span className="text-fg-subtle">{t('clients.protocols')}</span><span className="text-fg">{form.protocols.join(', ')}</span></div>
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-border mt-4">
        <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg bg-bg-raised text-fg-muted text-xs">{t('common.cancel')}</button>
        <button onClick={() => mutation.mutate()}
          disabled={!form.name || form.protocols.length === 0 || mutation.isPending}
          className="flex-1 px-3 py-2 rounded-lg text-white text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> {t('common.saving')}</> : isEdit ? t('common.save') : t('plans.createPlan')}
        </button>
      </div>
    </Modal>
  );
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

function EmptyPlans({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <div className="bg-surface border border-border rounded-xl p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-xl bg-bg-raised flex items-center justify-center mb-4">
        <CreditCard size={24} className="text-fg-muted" />
      </div>
      <h3 className="text-sm font-medium text-fg-muted">{t('plans.noPlans')}</h3>
      <p className="text-xs text-fg-muted mt-1 mb-4 max-w-xs mx-auto">{t('plans.noPlansDesc')}</p>
      <button onClick={onAdd} className="px-4 py-2 rounded-lg text-white text-xs font-medium" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>{t('plans.createFirstPlan')}</button>
    </div>
  );
}
