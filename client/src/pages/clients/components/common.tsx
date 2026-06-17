import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

export function Modal({ onClose, title, maxW = 'max-w-lg', children }: {
  onClose: () => void; title: string; maxW?: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={cn("bg-surface border border-border rounded-xl w-full shadow-xl max-h-[90vh] flex flex-col overflow-hidden", maxW)}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

export function InfoRow({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-fg-muted uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <span className={cn("flex-1 px-3 py-2 rounded-md bg-bg-raised border border-border text-xs text-fg truncate",
          mono && "font-mono"
        )}>{value}</span>
        {copy && <CopyBtn text={value} />}
      </div>
    </div>
  );
}

export function CopyBtn({ text, label, copied: externalCopied, onCopy }: {
  text: string; label?: string; copied?: string; onCopy?: (text: string, label: string) => void;
}) {
  const { t } = useI18n();
  const [internalCopied, setInternalCopied] = useState(false);
  const isCopied = externalCopied !== undefined ? externalCopied === label : internalCopied;

  const handleCopy = () => {
    if (onCopy) {
      onCopy(text, label || '');
    } else {
      navigator.clipboard.writeText(text);
      setInternalCopied(true);
      setTimeout(() => setInternalCopied(false), 2000);
    }
  };

  return (
    <button onClick={handleCopy}
      className="p-2 rounded-md bg-surface border border-border hover:border-border hover:bg-bg-raised text-fg-muted transition-all shrink-0 shadow-sm"
      title={t ? t('common.copy') : 'Copy'}>
      {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}
