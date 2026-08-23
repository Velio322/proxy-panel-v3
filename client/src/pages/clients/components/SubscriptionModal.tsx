import { useState } from 'react';
import { Client } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, Download, Copy, Check, QrCode } from 'lucide-react';
import { Modal } from './common';
import { buildSubUrl } from '../utils';

export function SubscriptionModal({ client: c, onClose }: { client: Client; onClose: () => void }) {
  const [format, setFormat] = useState<'base64' | 'clash' | 'singbox' | 'xray' | 'raw'>('base64');
  const subUrl = buildSubUrl(c.subToken);
  const [copied, setCopied] = useState('');

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const formats = [
    { key: 'base64' as const, label: 'Base64', desc: 'Universal Subscription' },
    { key: 'clash' as const, label: 'Clash YAML', desc: 'Mihomo / Verge' },
    { key: 'singbox' as const, label: 'Sing-box', desc: 'SFA / GUI / JSON' },
    { key: 'xray' as const, label: 'Xray JSON', desc: 'v2rayN / V2Ray' },
    { key: 'raw' as const, label: 'Raw Links', desc: 'Plain URI list' },
  ];

  const currentFormattedUrl = format === 'base64' ? subUrl : `${subUrl}?flag=${format}`;

  return (
    <Modal onClose={onClose} title="Client Subscription" maxW="max-w-lg">
      <div className="space-y-5">

        {/* Client Summary Banner */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-bg-raised border border-border/80 shadow-sm">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shadow-md bg-gradient-to-tr from-indigo-600 to-sky-400 text-white shrink-0">
            {c.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-fg truncate">{c.username}</span>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${c.banned ? 'bg-danger-muted text-danger border border-danger/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                {c.banned ? 'BANNED' : 'ACTIVE'}
              </span>
            </div>
            <div className="text-[11px] text-fg-subtle font-mono truncate">{c.uuid}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-bold text-fg">{formatBytes(Number(c.usedTraffic))}</div>
            <div className="text-[10px] text-fg-subtle font-mono">
              of {c.trafficLimit > 0n ? formatBytes(Number(c.trafficLimit)) : '∞ Unlimited'}
            </div>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-surface border border-border">
          <div className="p-3.5 bg-white rounded-2xl shadow-md border border-slate-200 ring-4 ring-indigo-500/10">
            <QRCodeSVG
              value={currentFormattedUrl}
              size={170}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="mt-3 text-[11px] font-medium text-fg-muted flex items-center gap-1.5">
            <QrCode size={13} className="text-accent" />
            Scan with Shadowrocket, v2rayNG, Sing-box or Clash
          </p>
        </div>

        {/* Format Switcher Pills */}
        <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-bg-sunken border border-border">
          {formats.map((f) => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={`px-2 py-2 rounded-lg text-center transition-all ${
                format === f.key
                  ? 'bg-surface text-accent font-bold shadow-sm border border-border/80'
                  : 'text-fg-muted hover:text-fg hover:bg-surface/50 font-medium'
              }`}
            >
              <div className="text-xs leading-none">{f.label}</div>
              <div className="text-[9px] text-fg-subtle mt-1 truncate hidden sm:block">{f.desc}</div>
            </button>
          ))}
        </div>

        {/* Link & Copy Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-fg-muted">
            <span>Subscription URL ({format.toUpperCase()})</span>
            {copied === 'suburl' && <span className="text-emerald-500 font-bold flex items-center gap-1"><Check size={12} /> Copied!</span>}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentFormattedUrl}
              className="input-base font-mono text-xs text-fg flex-1 select-all"
            />
            <button
              onClick={() => copy(currentFormattedUrl, 'suburl')}
              className="btn-primary px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5"
            >
              {copied === 'suburl' ? <Check size={14} /> : <Copy size={14} />}
              Copy
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <a
            href={currentFormattedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-fg text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <ExternalLink size={14} /> Open in Browser
          </a>
          <a
            href={currentFormattedUrl}
            download={`${c.username}_${format}.${format === 'clash' ? 'yaml' : format === 'base64' ? 'txt' : 'json'}`}
            className="btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Download size={14} /> Download Config
          </a>
        </div>
      </div>
    </Modal>
  );
}
