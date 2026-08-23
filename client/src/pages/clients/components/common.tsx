import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

export function Modal({ onClose, title, maxW = 'max-w-lg', children }: {
  onClose: () => void; title: string; maxW?: string; children: React.ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className={cn("bg-surface/90 border border-border rounded-2xl w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden backdrop-blur-xl", maxW)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-bg-raised/40 shrink-0">
          <h2 className="text-sm font-bold text-fg">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-surface-hover text-fg-subtle hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function InfoRow({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-fg-muted uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <span className={cn(
          "flex-1 px-3 py-2 rounded-xl bg-bg-sunken border border-border text-xs text-fg truncate select-all",
          mono && "font-mono"
        )}>
          {value}
        </span>
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
    <button
      type="button"
      onClick={handleCopy}
      className="p-2 rounded-xl bg-surface border border-border hover:border-accent hover:text-accent text-fg-muted transition-all shrink-0 shadow-sm"
      title={t ? t('common.copy') : 'Copy'}
    >
      {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}
