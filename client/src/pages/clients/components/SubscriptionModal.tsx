import { useState } from 'react';
import { Client } from '@/lib/api';
import { formatBytes, cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, Download } from 'lucide-react';
import { Modal, CopyBtn } from './common';
import { buildSubUrl } from '../utils';

export function SubscriptionModal({ client: c, onClose }: { client: Client; onClose: () => void }) {
  const { t } = useI18n();
  const [format, setFormat] = useState<'base64' | 'clash' | 'singbox' | 'url'>('base64');
  const subUrl = buildSubUrl(c.subToken);
  const [copied, setCopied] = useState('');

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const formats = [
    { key: 'base64' as const, label: t('clients.base64'), desc: t('clients.universal') },
    { key: 'url' as const, label: t('clients.url'), desc: t('clients.vlessLink') },
    { key: 'clash' as const, label: t('clients.clash'), desc: t('clients.mihomo') },
    { key: 'singbox' as const, label: t('clients.singbox'), desc: 'sing-box' },
  ];

  const lc = "block text-[10px] font-bold text-fg-subtle uppercase tracking-widest mb-1.5";

  return (
    <Modal onClose={onClose} title={t('clients.subscription')} maxW="max-w-md">
      <div className="space-y-6">
        {/* Client Info Card */}
        <div className="flex items-center gap-4 p-4 bg-bg-raised border border-border-subtle rounded-xl shadow-sm">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>
            {c.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-fg">{c.username}</div>
            <div className="text-[10px] text-fg-subtle font-mono truncate">{c.uuid}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-fg">{formatBytes(Number(c.usedTraffic))}</div>
            <div className="text-[9px] text-fg-subtle uppercase tracking-tighter">of {c.trafficLimit > 0 ? formatBytes(Number(c.trafficLimit)) : '∞'}</div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="flex flex-col items-center">
          <div className="p-4 bg-surface border border-border-subtle rounded-2xl shadow-lg ring-4 ring-border-subtle">
            <QRCodeSVG
              value={subUrl}
              size={180}
              bgColor="white"
              fgColor="#09090b"
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="mt-4 text-[10px] font-bold text-fg-subtle uppercase tracking-widest">{t('clients.scanToConnect')}</p>
        </div>

        {/* Format Select - Minimalist Tabs */}
        <div className="flex gap-1 bg-bg-raised rounded-lg p-1">
          {formats.map((f) => (
            <button key={f.key} onClick={() => setFormat(f.key)}
              className={cn("flex-1 px-2 py-2 rounded-md transition-all",
                format === f.key ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
              )}>
              <div className="text-[10px] font-bold uppercase tracking-tight leading-none mb-1">{f.label}</div>
              <div className="text-[9px] opacity-60 leading-none">{f.desc}</div>
            </button>
          ))}
        </div>

        {/* Links */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={lc}>{t('clients.subscriptionLink')}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-bg-raised border border-border text-fg-muted text-[11px] font-mono truncate">{subUrl}</code>
              <CopyBtn text={subUrl} label="link" copied={copied} onCopy={copy} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={lc}>{t('clients.withFormat')}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-bg-raised border border-border text-fg font-bold text-[11px] font-mono truncate">{subUrl}?flag={format}</code>
              <CopyBtn text={`${subUrl}?flag=${format}`} label="format" copied={copied} onCopy={copy} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3">
          <a href={subUrl} target="_blank" rel="noopener"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-fg-muted text-xs font-bold hover:bg-bg-raised transition-all shadow-sm active:scale-95">
            <ExternalLink size={14} /> {t('clients.open')}
          </a>
          <a href={`${subUrl}?flag=${format}`} download
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white text-xs font-bold transition-all shadow-md active:scale-95" style={{ background: 'var(--surface-invert)', color: 'var(--fg-invert)' }}>
            <Download size={14} /> {t('clients.download')}
          </a>
        </div>
      </div>
    </Modal>
  );
}
