import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi, AuditLog } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import {
  FileText, Loader2, Search, ChevronDown, ChevronRight,
  User, Shield, Server, Users, Network, CreditCard, Settings,
  LogIn, LogOut, Plus, Trash2, Edit3, Download, Key,
  Calendar, Copy, Check, AlertTriangle,
  Activity, Ban, RotateCcw, ArrowUpDown, Clock
} from 'lucide-react';

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

const ACTION_CONFIG: Record<string, { icon: any; color: string; bg: string; labelKey: string }> = {
  CREATE: { icon: Plus, color: 'text-blue-400', bg: 'bg-blue-500/10', labelKey: 'audit.created' },
  UPDATE: { icon: Edit3, color: 'text-amber-400', bg: 'bg-amber-500/10', labelKey: 'audit.updated' },
  DELETE: { icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10', labelKey: 'audit.deleted' },
  LOGIN: { icon: LogIn, color: 'text-green-400', bg: 'bg-green-500/10', labelKey: 'audit.login' },
  LOGOUT: { icon: LogOut, color: 'text-fg-muted', bg: 'bg-fg-subtle/10', labelKey: 'audit.logout' },
  TOGGLE_BAN: { icon: Ban, color: 'text-red-400', bg: 'bg-red-500/10', labelKey: 'audit.banToggle' },
  RESET_TRAFFIC: { icon: RotateCcw, color: 'text-cyan-400', bg: 'bg-cyan-500/10', labelKey: 'audit.resetTraffic' },
  RESET_PASSWORD: { icon: Key, color: 'text-amber-400', bg: 'bg-amber-500/10', labelKey: 'audit.passwordReset' },
  PUSH_CONFIG: { icon: ArrowUpDown, color: 'text-[hsl(var(--accent))]', bg: 'bg-[hsl(var(--accent-light))]', labelKey: 'audit.configPush' },
  RESTART: { icon: RotateCcw, color: 'text-orange-400', bg: 'bg-orange-500/10', labelKey: 'audit.restart' },
  STOP: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', labelKey: 'audit.stop' },
  TOGGLE: { icon: ArrowUpDown, color: 'text-fg-muted', bg: 'bg-fg-subtle/10', labelKey: 'audit.toggle' },
  PAY: { icon: CreditCard, color: 'text-green-400', bg: 'bg-green-500/10', labelKey: 'audit.payment' },
  EXPORT: { icon: Download, color: 'text-cyan-400', bg: 'bg-cyan-500/10', labelKey: 'audit.export' },
};

const RESOURCE_CONFIG: Record<string, { icon: any; color: string }> = {
  user: { icon: User, color: 'text-blue-400' },
  client: { icon: Users, color: 'text-[hsl(var(--accent))]' },
  node: { icon: Server, color: 'text-green-400' },
  inbound: { icon: Network, color: 'text-cyan-400' },
  plan: { icon: CreditCard, color: 'text-amber-400' },
  invoice: { icon: FileText, color: 'text-pink-400' },
  apiKey: { icon: Key, color: 'text-fg-muted' },
  portShare: { icon: Network, color: 'text-orange-400' },
  reseller: { icon: Shield, color: 'text-success' },
  settings: { icon: Settings, color: 'text-fg-muted' },
  'reseller+user': { icon: Shield, color: 'text-success' },
};

const ALL_ACTIONS = Object.keys(ACTION_CONFIG);
const ALL_RESOURCES = Object.keys(RESOURCE_CONFIG);

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function AuditPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'timeline'>('table');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit', actionFilter, resourceFilter, dateFrom, dateTo, page],
    queryFn: () => auditApi.getAll({
      action: actionFilter || undefined,
      resource: resourceFilter || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
      page,
      limit: 30,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 30);

  // Group by date for timeline view
  const grouped = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const date = new Date(log.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(log);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <FileText size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">{t('audit.title')}</h1>
            <p className="text-xs text-fg-subtle">{t('audit.eventsCount', { total })} · {isFetching ? t('audit.updating') : t('audit.upToDate')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-bg-raised/50 rounded-lg p-0.5">
            <button onClick={() => setView('table')}
              className={cn("px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                view === 'table' ? "bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]" : "text-fg-subtle hover:text-fg-muted")}>
              {t('audit.table')}
            </button>
            <button onClick={() => setView('timeline')}
              className={cn("px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                view === 'timeline' ? "bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]" : "text-fg-subtle hover:text-fg-muted")}>
              {t('audit.timeline')}
            </button>
          </div>
          <button onClick={() => exportLogs(logs)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-raised hover:bg-bg-sunken text-fg-muted text-xs transition-colors">
            <Download size={13} /> {t('audit.export')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input type="text" placeholder={t('audit.searchPlaceholder')}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent/0.3))]" />
        </div>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none appearance-none cursor-pointer">
          <option value="">{t('audit.allActions')}</option>
          {ALL_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_CONFIG[a]?.labelKey ? t(ACTION_CONFIG[a].labelKey) : a}</option>)}
        </select>
        <select value={resourceFilter} onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none appearance-none cursor-pointer">
          <option value="">{t('audit.allResources')}</option>
          {ALL_RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none" />
        <span className="text-fg-muted text-xs">—</span>
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none" />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} /></div>
      ) : logs.length === 0 ? (
        <EmptyLogs />
      ) : view === 'table' ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider">
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle w-8"></th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('audit.colTime')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('audit.colUser')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('audit.colAction')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('audit.colResource')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('audit.colIP')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('audit.colDetails')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredLogs(logs, search).map((log) => (
                <LogRow key={log.id} log={log}
                  expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Timeline View */
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([date, dayLogs]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={12} className="text-fg-subtle" />
                <span className="text-xs font-medium text-fg-muted">{date}</span>
                <span className="text-[10px] text-fg-muted">({t('audit.eventsCount', { total: dayLogs.length })})</span>
                <div className="flex-1 h-px bg-bg-raised" />
              </div>
              <div className="space-y-1 ml-5 border-l border-border pl-4">
                {dayLogs.map((log) => (
                  <TimelineEntry key={log.id} log={log}
                    expanded={expandedId === log.id}
                    onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-fg-subtle">{t('audit.pageInfo', { page, pages, total })}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-bg-raised text-xs text-fg-muted disabled:opacity-40">{t('audit.prev')}</button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
              if (p > pages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("px-2.5 py-1 rounded text-xs", p === page ? "bg-[hsl(var(--accent))] text-white" : "bg-bg-raised text-fg-muted hover:bg-bg-sunken")}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages}
              className="px-2.5 py-1 rounded bg-bg-raised text-xs text-fg-muted disabled:opacity-40">{t('audit.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Table Row
// ══════════════════════════════════════════════

function LogRow({ log, expanded, onToggle }: { log: AuditLog; expanded: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const actionConf = ACTION_CONFIG[log.action] || { icon: Activity, color: 'text-fg-muted', bg: 'bg-fg-subtle/10', labelKey: log.action };
  const resourceConf = RESOURCE_CONFIG[log.resource] || { icon: FileText, color: 'text-fg-muted' };
  const ActionIcon = actionConf.icon;
  const ResourceIcon = resourceConf.icon;
  const time = new Date(log.createdAt);
  const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const copyId = () => {
    navigator.clipboard.writeText(log.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <tr className="hover:bg-bg-raised/20 cursor-pointer transition-colors" onClick={onToggle}>
        <td className="px-3 py-2">
          {expanded ? <ChevronDown size={12} className="text-fg-subtle" /> : <ChevronRight size={12} className="text-fg-muted" />}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-fg-muted" />
            <span className="text-[11px] text-fg-muted">{timeStr}</span>
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-bg-raised flex items-center justify-center">
              <span className="text-[9px] font-bold text-fg-muted">{log.user?.username?.[0]?.toUpperCase() || '?'}</span>
            </div>
            <span className="text-xs text-fg-muted">{log.user?.username || t('audit.system')}</span>
            {log.user?.role && (
              <span className="text-[9px] text-fg-muted bg-bg-raised px-1 py-0.5 rounded">{log.user.role.replace('_', ' ')}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium", actionConf.bg, actionConf.color)}>
            <ActionIcon size={10} /> {t(actionConf.labelKey)}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <ResourceIcon size={12} className={resourceConf.color} />
            <span className="text-xs text-fg-muted">{log.resource}</span>
            {log.resourceId && (
              <span className="text-[9px] text-fg-muted font-mono truncate max-w-[80px]">{log.resourceId.slice(0, 8)}...</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <span className="text-[11px] text-fg-subtle font-mono">{log.ip || '—'}</span>
        </td>
        <td className="px-3 py-2">
          {log.details && (
            <span className="text-[10px] text-fg-muted">
              {log.details.method && `${log.details.method} `}
              {log.details.path || ''}
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-3 pb-3">
            <div className="bg-bg-raised rounded-lg p-3 space-y-2 ml-6">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-fg-subtle">{t('audit.id')}:</span>
                <code className="text-fg-muted font-mono">{log.id}</code>
                <button onClick={(e) => { e.stopPropagation(); copyId(); }}
                  className="text-fg-muted hover:text-fg-muted">
                  {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-fg-subtle">{t('audit.fullTime')}:</span>
                <span className="text-fg-muted">{formatDate(log.createdAt)}</span>
              </div>
              {log.details && (
                <div>
                  <span className="text-[10px] text-fg-subtle block mb-1">{t('audit.details')}:</span>
                  <pre className="text-[10px] text-fg-muted font-mono bg-surface rounded p-2 overflow-x-auto max-h-40">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
              {log.userAgent && (
                <div className="text-[10px]">
                  <span className="text-fg-subtle">{t('audit.userAgent')}: </span>
                  <span className="text-fg-muted break-all">{log.userAgent}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ══════════════════════════════════════════════
// Timeline Entry
// ══════════════════════════════════════════════

function TimelineEntry({ log, expanded, onToggle }: { log: AuditLog; expanded: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const actionConf = ACTION_CONFIG[log.action] || { icon: Activity, color: 'text-fg-muted', bg: 'bg-fg-subtle/10', labelKey: log.action };
  const ActionIcon = actionConf.icon;
  const time = new Date(log.createdAt);
  const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="group">
      <div className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-bg-raised/20 rounded px-2 -mx-2" onClick={onToggle}>
        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", actionConf.bg)}>
          <ActionIcon size={11} className={actionConf.color} />
        </div>
        <span className="text-[10px] text-fg-muted w-16 shrink-0">{timeStr}</span>
        <span className="text-xs text-fg-muted">{log.user?.username || t('audit.system')}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", actionConf.bg, actionConf.color)}>{t(actionConf.labelKey)}</span>
        <span className="text-[10px] text-fg-subtle">{log.resource}</span>
        {log.resourceId && (
          <span className="text-[9px] text-fg-muted font-mono truncate max-w-[60px]">{log.resourceId.slice(0, 8)}</span>
        )}
        <div className="flex-1" />
        {expanded ? <ChevronDown size={11} className="text-fg-muted" /> : <ChevronRight size={11} className="text-fg opacity-0 group-hover:opacity-100" />}
      </div>
      {expanded && log.details && (
        <div className="ml-8 mb-2">
          <pre className="text-[10px] text-fg-muted font-mono bg-bg-raised rounded p-2 overflow-x-auto max-h-32">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

function filteredLogs(logs: AuditLog[], search: string): AuditLog[] {
  if (!search) return logs;
  const s = search.toLowerCase();
  return logs.filter((log) =>
    log.action.toLowerCase().includes(s) ||
    log.resource.toLowerCase().includes(s) ||
    log.user?.username?.toLowerCase().includes(s) ||
    log.ip?.toLowerCase().includes(s) ||
    log.id.toLowerCase().includes(s)
  );
}

function exportLogs(logs: AuditLog[]) {
  const csv = [
    ['Time', 'User', 'Action', 'Resource', 'ResourceID', 'IP', 'Details'].join(','),
    ...logs.map((l) => [
      l.createdAt,
      l.user?.username || 'System',
      l.action,
      l.resource,
      l.resourceId || '',
      l.ip || '',
      l.details ? JSON.stringify(l.details).replace(/"/g, '""') : '',
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
// Empty State
// ══════════════════════════════════════════════

function EmptyLogs() {
  const { t } = useI18n();
  return (
    <div className="bg-surface border border-border rounded-xl p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-xl bg-bg-raised flex items-center justify-center mb-4">
        <FileText size={24} className="text-fg-muted" />
      </div>
      <h3 className="text-sm font-medium text-fg-muted">{t('audit.noEntries')}</h3>
      <p className="text-xs text-fg-muted mt-1">{t('audit.noEntriesDesc')}</p>
    </div>
  );
}
