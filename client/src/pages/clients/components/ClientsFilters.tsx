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
    <div className="flex flex-col md:flex-row items-center gap-3">
      <div className="relative flex-1 w-full md:max-w-md group">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-accent transition-colors" />
        <input
          type="text"
          placeholder={t('clients.searchPlaceholder') || 'Search by username, UUID, or email...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base pl-10 pr-9 rounded-xl text-xs"
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
        <div className="relative">
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="input-base pl-3.5 pr-8 py-2 rounded-xl text-xs cursor-pointer appearance-none bg-surface"
          >
            <option value="">{t('clients.allProtocols')}</option>
            {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base pl-3.5 pr-8 py-2 rounded-xl text-xs cursor-pointer appearance-none bg-surface"
          >
            <option value="">{t('clients.allStatus')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="banned">{t('common.banned')}</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
