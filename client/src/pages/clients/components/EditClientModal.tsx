import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { Modal } from './common';
import { PROTOCOLS, ClientEditProps } from '../types';
import { protocolColor } from '../utils';

export function EditClientModal({ client, onClose }: ClientEditProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    email: client.email || '',
    note: client.note || '',
    trafficLimitGB: client.trafficLimit > 0 ? Math.round(Number(client.trafficLimit) / 1073741824) : 0,
    protocols: client.protocols || ['VLESS', 'HYSTERIA2'],
  });

  const update = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const toggleProto = (p: string) => {
    const protos = form.protocols.includes(p) ? form.protocols.filter((x) => x !== p) : [...form.protocols, p];
    update('protocols', protos);
  };

  const mutation = useMutation({
    mutationFn: () => clientsApi.update(client.id, {
      email: form.email || undefined,
      note: form.note || undefined,
      trafficLimit: form.trafficLimitGB > 0 ? form.trafficLimitGB * 1073741824 : 0,
      protocols: form.protocols,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  const ic = "w-full px-3 py-2 rounded-lg bg-bg-raised border border-border text-fg text-sm focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg transition-all shadow-sm";
  const lc = "block text-[11px] font-bold text-fg-muted uppercase tracking-widest mb-1.5";

  return (
    <Modal onClose={onClose} title={`${t('clients.edit')} ${client.username}`} maxW="max-w-md">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={lc}>UUID</label>
          <div className="px-3 py-2 rounded-lg bg-bg-raised border border-border-subtle text-fg-subtle text-xs font-mono shadow-inner">{client.uuid}</div>
        </div>
        <div className="space-y-1.5">
          <label className={lc}>{t('clients.email')}</label>
          <input className={ic} value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className={lc}>{t('clients.trafficLimit')}</label>
          <div className="relative">
            <input className={ic} type="number" value={form.trafficLimitGB} onChange={(e) => update('trafficLimitGB', +e.target.value)} min={0} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-fg-subtle uppercase">GB</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className={lc}>{t('clients.protocols')}</label>
          <div className="flex flex-wrap gap-2">
            {PROTOCOLS.map((p) => (
              <button key={p} onClick={() => toggleProto(p)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm",
                  form.protocols.includes(p) ? protocolColor(p) : "border-border text-fg-subtle"
                )}>{p}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={lc}>{t('clients.note')}</label>
          <input className={ic} value={form.note} onChange={(e) => update('note', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-6 border-t border-border-subtle mt-6">
        <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-fg-muted text-sm font-medium hover:bg-bg-raised transition-colors">{t('common.cancel')}</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 transition-all shadow-md" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>
          {mutation.isPending ? t('clients.saving') : t('nodes.saveChanges')}
        </button>
      </div>
    </Modal>
  );
}
