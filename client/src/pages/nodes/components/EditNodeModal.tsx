import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesApi } from '@/lib/api';
import { useI18n } from '@/i18n';
import { Modal, Field } from './common';
import { NodeEditProps } from '../types';

export function EditNodeModal({ node, onClose }: NodeEditProps) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: node.name, host: node.host, port: node.port, apiPort: node.apiPort,
    country: node.country || '', city: node.city || '', isp: node.isp || '',
    tags: (node.tags || []).join(', '),
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => nodesApi.update(node.id, {
      name: form.name, host: form.host, port: form.port, apiPort: form.apiPort,
      country: form.country || undefined, city: form.city || undefined, isp: form.isp || undefined,
      tags: form.tags ? form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); onClose(); },
  });

  return (
    <Modal onClose={onClose} title={`${t('nodes.edit')} ${node.name}`} maxW="max-w-lg">
      <div className="space-y-4">
        <Field label={t('nodes.nodeName')} value={form.name} onChange={(v) => update('name', v)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('nodes.hostLabel')} value={form.host} onChange={(v) => update('host', v)} />
          <Field label={t('nodes.port')} value={form.port} onChange={(v) => update('port', +v)} type="number" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t('nodes.country')} value={form.country} onChange={(v) => update('country', v)} />
          <Field label={t('nodes.city')} value={form.city} onChange={(v) => update('city', v)} />
          <Field label={t('nodes.isp')} value={form.isp} onChange={(v) => update('isp', v)} />
        </div>
        <Field label={t('nodes.tags')} value={form.tags} onChange={(v) => update('tags', v)} placeholder="comma-separated" />
      </div>
      <div className="flex gap-3 pt-6 border-t border-border-subtle mt-8">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-fg-muted text-sm font-bold hover:bg-bg-raised transition-all">{t('common.cancel')}</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-bold shadow-md hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]">
          {mutation.isPending ? t('nodes.saving') : t('nodes.saveChanges')}
        </button>
      </div>
    </Modal>
  );
}
