import { Search, ChevronDown, LayoutGrid, List, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface NodesFiltersProps {
  search: string;
  setSearch: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (m: 'grid' | 'table') => void;
}

export function NodesFilters({
  search, setSearch, statusFilter, setStatusFilter, viewMode, setViewMode
}: NodesFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col md:flex-row items-center gap-3 mb-6">
      <div className="relative flex-1 w-full md:max-w-md group">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within:text-[var(--accent)] transition-colors" />
        <input
          type="text"
          placeholder={t('nodes.searchPlaceholder') || 'Search nodes...'}
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
      
      <div className="flex items-center gap-2 w-full md:w-auto">
        <div className="relative">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)} 
            className="input-base pl-3 pr-8 cursor-pointer appearance-none"
          >
            <option value="">{t('common.allStatus')}</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="ERROR">Error</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        </div>

        <div className="h-[38px] p-1 bg-bg-sunken flex gap-1 border border-border">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-1.5 transition-all",
              viewMode === 'grid' ? "bg-surface text-fg border border-border" : "text-fg-subtle hover:text-fg-muted border border-transparent"
            )}
            title="Grid View"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              "p-1.5 transition-all",
              viewMode === 'table' ? "bg-surface text-fg border border-border" : "text-fg-subtle hover:text-fg-muted border border-transparent"
            )}
            title="Table View"
          >
            <List size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
