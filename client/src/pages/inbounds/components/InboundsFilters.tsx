import { Search, ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Node } from '@/lib/api';
import { PROTOCOLS } from '../types';

interface InboundsFiltersProps {
  search: string;
  setSearch: (s: string) => void;
  protoFilter: string;
  setProtoFilter: (p: string) => void;
  nodeFilter: string;
  setNodeFilter: (n: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  nodes: Node[];
}

export function InboundsFilters({
  search, setSearch, protoFilter, setProtoFilter, nodeFilter, setNodeFilter, statusFilter, setStatusFilter, nodes
}: InboundsFiltersProps) {
  const { t } = useI18n();

  const selectCls = "h-9 pl-3 pr-8 rounded-lg bg-surface border border-border text-fg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg appearance-none cursor-pointer transition-all shadow-sm";

  return (
    <div className="flex flex-col md:flex-row items-center gap-3 mb-6">
      <div className="relative flex-1 w-full md:max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input
          type="text"
          placeholder={t('inbounds.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-4 rounded-lg bg-surface border border-border text-fg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-fg/5 focus:border-fg transition-all shadow-sm placeholder:text-fg-subtle"
        />
      </div>
      
      <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <div className="relative">
          <select value={protoFilter} onChange={(e) => setProtoFilter(e.target.value)} className={selectCls}>
            <option value="">{t('inbounds.allProtocols')}</option>
            {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>

        <div className="relative">
          <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)} className={selectCls}>
            <option value="">{t('inbounds.allNodes')}</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>

        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">{t('inbounds.allStatus')}</option>
            <option value="enabled">{t('common.enabled')}</option>
            <option value="disabled">{t('common.disabled')}</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
