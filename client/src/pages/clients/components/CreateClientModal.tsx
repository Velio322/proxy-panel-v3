import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { Check, Loader2, Info } from 'lucide-react';
import { Modal, InfoRow, CopyBtn } from './common';
import { PROTOCOLS, FLOWS, CreateForm, ClientCreateProps } from '../types';
import { genPassword, buildSubUrl, protocolColor } from '../utils';

export function CreateClientModal({ onClose, inbounds }: ClientCreateProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'general' | 'protocols' | 'limits'>('general');
  const [form, setForm] = useState<CreateForm>({
    username: '', email: '', password: '',
    protocols: ['VLESS', 'HYSTERIA2'],
    expireDays: 30, trafficLimitGB: 100, speedLimitMbps: 0,
    note: '', inboundId: '', flow: 'xtls-rprx-vision',
  });
  const [created, setCreated] = useState<any>(null);

  const update = <K extends keyof CreateForm>(key: K, val: CreateForm[K]) => setForm((f) => ({ ...f, [key]: val }));
  const toggleProto = (p: string) => {
    const protos = form.protocols.includes(p) ? form.protocols.filter((x) => x !== p) : [...form.protocols, p];
    update('protocols', protos);
  };

  const mutation = useMutation({
    mutationFn: () => clientsApi.create({
      username: form.username,
      email: form.email || undefined,
      password: form.password || undefined,
      protocols: form.protocols,
      trafficLimit: form.trafficLimitGB > 0 ? form.trafficLimitGB * 1073741824 : 0,
      expireAt: form.expireDays > 0 ? new Date(Date.now() + form.expireDays * 86400000).toISOString() : undefined,
      note: form.note || undefined,
    }),
    onSuccess: (r) => { setCreated(r.data); qc.invalidateQueries({ queryKey: ['clients'] }); },
  });

  const ic = "w-full px-3 py-2 rounded-lg bg-bg-raised border border-border text-fg text-sm focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg transition-all placeholder:text-fg-subtle";
  const lc = "block text-[11px] font-semibold text-fg-muted uppercase tracking-wider mb-1.5";

  if (created) {
    const subUrl = buildSubUrl(created.subToken || created.subId);
    return (
      <Modal onClose={onClose} title={t('clients.clientCreated')} maxW="max-w-md">
        <div className="space-y-4">
          <div className="border rounded-lg p-3 text-xs flex items-center gap-2.5" style={{ background: 'var(--success-muted)', borderColor: 'var(--success)', color: 'var(--success)' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--success)' }}>
              <Check size={12} className="text-white" />
            </div>
            {t('clients.clientCreatedSuccess')}
          </div>
          <InfoRow label={t('clients.username')} value={created.username} />
          <InfoRow label={t('clients.passwordIs')} value={created.password} mono copy />
          <InfoRow label="UUID" value={created.uuid} mono copy />
          <div className="space-y-1.5">
            <label className={lc}>{t('clients.subUrl')}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-md bg-bg-raised border border-border text-fg-muted text-[11px] font-mono truncate">{subUrl}</code>
              <CopyBtn text={subUrl} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setCreated(null)} className="flex-1 px-4 py-2 rounded-lg border border-border text-fg-muted text-sm font-medium hover:bg-bg-raised transition-colors">{t('clients.createAnother')}</button>
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>{t('clients.done')}</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={t('clients.addClient')} maxW="max-w-lg">
      <div className="flex gap-1 bg-bg-raised rounded-lg p-1 mb-6">
        {(['general', 'protocols', 'limits'] as const).map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={cn("flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
              tab === tabKey ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
            )}>{t(`clients.${tabKey}`)}</button>
        ))}
      </div>

      <div className="min-h-[280px]">
        {tab === 'general' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={lc}>{t('clients.usernameRequired')}</label>
                <input className={ic} value={form.username} onChange={(e) => update('username', e.target.value)} placeholder="user1" />
              </div>
              <div className="space-y-1.5">
                <label className={lc}>{t('clients.email')}</label>
                <input className={ic} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="user@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={lc}>{t('clients.password')}</label>
              <div className="flex gap-2">
                <input className={ic} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder={t('clients.autoGenerated')} />
                <button onClick={() => update('password', genPassword())} className="px-3 rounded-lg border border-border text-fg-muted hover:text-fg hover:bg-bg-raised text-xs font-medium transition-colors shrink-0">{t('clients.generate')}</button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={lc}>{t('clients.note')}</label>
              <input className={ic} value={form.note} onChange={(e) => update('note', e.target.value)} placeholder={t('clients.note')} />
            </div>
          </div>
        )}

        {tab === 'protocols' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="space-y-3">
              <label className={lc}>{t('clients.allowedProtocols')}</label>
              <div className="flex flex-wrap gap-2">
                {PROTOCOLS.map((p) => (
                  <button key={p} onClick={() => toggleProto(p)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                      form.protocols.includes(p) ? protocolColor(p) : "border-border text-fg-subtle hover:border-border hover:text-fg-muted"
                    )}>{p}</button>
                ))}
              </div>
            </div>
            {(form.protocols.includes('VLESS') || form.protocols.includes('TROJAN')) && (
              <div className="space-y-1.5">
                <label className={lc}>{t('clients.flowControl')}</label>
                <select className={ic} value={form.flow} onChange={(e) => update('flow', e.target.value)}>
                  {FLOWS.map((f) => <option key={f} value={f}>{f || t('clients.flowNone')}</option>)}
                </select>
              </div>
            )}
            {inbounds.length > 0 && (
              <div className="space-y-1.5">
                <label className={lc}>{t('clients.bindToInbound')}</label>
                <select className={ic} value={form.inboundId} onChange={(e) => update('inboundId', e.target.value)}>
                  <option value="">{t('clients.autoAssign')}</option>
                  {inbounds.map((i) => (
                    <option key={i.id} value={i.id}>{i.tag} ({i.protocol} : {i.port})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {tab === 'limits' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={lc}>{t('clients.expireDays')}</label>
                <input className={ic} type="number" value={form.expireDays} onChange={(e) => update('expireDays', +e.target.value)} min={0} />
              </div>
              <div className="space-y-1.5">
                <label className={lc}>{t('clients.trafficLimit')}</label>
                <input className={ic} type="number" value={form.trafficLimitGB} onChange={(e) => update('trafficLimitGB', +e.target.value)} min={0} />
              </div>
            </div>
            <div className="p-4 bg-bg-raised border border-border rounded-xl space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-fg font-bold text-xs mb-1">
                <Info size={14} className="text-fg-subtle" />
                {t('clients.summary')}
              </div>
              <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('clients.summaryProtocols')}</span><span className="text-fg font-bold">{form.protocols.join(', ') || t('common.none')}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('clients.summaryExpiry')}</span><span className="text-fg font-bold">{form.expireDays > 0 ? t('clients.summaryDays', { count: form.expireDays }) : t('clients.summaryNever')}</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-fg-muted font-medium">{t('clients.summaryTraffic')}</span><span className="text-fg font-bold">{form.trafficLimitGB > 0 ? t('clients.summaryGB', { count: form.trafficLimitGB }) : t('clients.unlimited')}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-6 border-t border-border-subtle mt-6">
        <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-fg-muted text-sm font-medium hover:bg-bg-raised transition-colors">{t('common.cancel')}</button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!form.username || form.protocols.length === 0 || mutation.isPending}
          className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}
        >
          {mutation.isPending ? <><Loader2 size={14} className="animate-spin" /> {t('clients.creating')}</> : t('clients.addClient')}
        </button>
      </div>
    </Modal>
  );
}
