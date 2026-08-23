import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

export function Modal({ onClose, title, maxW = 'max-w-lg', children }: {
  onClose: () => void; title: string; maxW?: string; children: React.ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className={cn("bg-surface border border-border rounded-2xl w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden", maxW)}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-bg-raised/40 shrink-0">
          <h2 className="text-sm font-bold text-fg">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-surface-hover text-fg-subtle hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-fg-muted uppercase tracking-wider">{label}</label>
      <input 
        className="w-full h-9 px-3 rounded-lg bg-bg-raised border border-border text-fg text-sm focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg transition-all placeholder:text-fg-subtle" 
        type={type} value={value} onChange={(e) => onChange(type === 'number' ? +e.target.value : e.target.value)}
        placeholder={placeholder} 
      />
    </div>
  );
}

export function MiniField({ label, value, onChange, type = 'text', placeholder, options }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; placeholder?: string; options?: string[];
}) {
  const { t } = useI18n();
  if (options) {
    return (
      <div className="space-y-1">
        <label className="block text-[9px] font-bold text-fg-subtle uppercase">{label}</label>
        <select className="w-full h-8 px-2 rounded-md bg-surface border border-border text-fg text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg appearance-none transition-all"
          value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o || t('common.none')}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="block text-[9px] font-bold text-fg-subtle uppercase">{label}</label>
      <input className="w-full h-8 px-2 rounded-md bg-surface border border-border text-fg text-[11px] focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg transition-all placeholder:text-fg-subtle"
        type={type} value={value} onChange={(e) => onChange(type === 'number' ? +e.target.value : e.target.value)}
        placeholder={placeholder} />
    </div>
  );
}

export function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1 bg-bg-raised rounded-lg p-1 mb-6">
      {tabs.map((tab) => (
        <button key={tab} onClick={() => onChange(tab)}
          className={cn("flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
            active === tab ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
          )}>{t(`nodes.${tab}`)}</button>
      ))}
    </div>
  );
}
