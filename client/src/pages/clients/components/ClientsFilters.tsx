import { Search, ChevronDown, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { PROTOCOLS } from '../types';

interface ClientsFiltersProps {
  search: string;
  setSearch: (s: string) => void;
  protocolFilter: string;
  setProtocolFilter: (p: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
}

export function ClientsFilters({
  search, setSearch, protocolFilter, setProtocolFilter, statusFilter, setStatusFilter
}: ClientsFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col md:flex-row items-center gap-3 mb-4">
      <div className="relative flex-1 w-full md:max-w-md group">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-[var(--accent)] transition-colors" />
        <input
          type="text"
          placeholder={t('clients.searchPlaceholder') || 'Search clients...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base pl-9 pr-8"
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <div className="relative">
          <select value={protocolFilter} onChange={(e) => setProtocolFilter(e.target.value)} className="input-base pl-3 pr-8 cursor-pointer appearance-none">
            <option value="">{t('clients.allProtocols')}</option>
            {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>

        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base pl-3 pr-8 cursor-pointer appearance-none">
            <option value="">{t('clients.allStatus')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="banned">{t('common.banned')}</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
