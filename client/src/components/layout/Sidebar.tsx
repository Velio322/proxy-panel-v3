import { NavLink } from 'react-router-dom';
import { useI18n } from '@/i18n';
import {
  LayoutDashboard, Server, Users, Route, ScrollText,
  Activity, Settings, Shield, LogOut, Sun, Moon,
  Radio, Network
} from 'lucide-react';
import { useAuthStore, useAppStore } from '@/lib/store';

interface SidebarProps {
  onNavigate: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { t } = useI18n();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();

  const nav = [
    { to: '/',           icon: LayoutDashboard, label: t('nav.dashboard'), exact: true },
    { to: '/nodes',      icon: Server,          label: t('nav.nodes') },
    { to: '/inbounds',   icon: Network,         label: t('nav.inbounds') },
    { to: '/clients',    icon: Users,           label: t('nav.clients') },
    { to: '/monitoring', icon: Activity,        label: t('nav.monitoring') },
    { to: '/routing',    icon: Route,           label: t('nav.routing') },
  ];

  const admin = [
    { to: '/users',    icon: Shield,     label: t('nav.users') },
    { to: '/audit',    icon: ScrollText, label: t('nav.audit') },
    { to: '/settings', icon: Settings,   label: t('nav.settings') },
  ];

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border select-none">

      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 shrink-0 gap-3 border-b border-border/70">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 text-white shadow-lg shadow-indigo-500/25">
          <Radio size={18} className="animate-pulse" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-fg tracking-tight flex items-center gap-1.5">
            ProxPanel
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-accent-muted text-accent border border-accent/20">v3.0</span>
          </span>
          <span className="text-[11px] font-medium text-fg-subtle truncate">
            Multi-Core VPN Manager
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {/* Main Section */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            {t('sidebar.overview')}
          </div>
          <div className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                    isActive
                      ? 'nav-link-active shadow-sm'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={18}
                      className={`shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                        isActive ? 'text-accent' : 'text-fg-subtle group-hover:text-fg'
                      }`}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Administration Section */}
        {user?.role !== 'RESELLER' && user?.role !== 'OPERATOR' && (
          <div>
            <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              {t('sidebar.administration')}
            </div>
            <div className="space-y-1">
              {admin.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                      isActive
                        ? 'nav-link-active shadow-sm'
                        : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={18}
                        className={`shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                          isActive ? 'text-accent' : 'text-fg-subtle group-hover:text-fg'
                        }`}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User & Theme Footer */}
      <div className="shrink-0 p-3 space-y-2 border-t border-border/70 bg-bg-raised/30">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {theme === 'dark' ? <Moon size={15} className="text-indigo-400" /> : <Sun size={15} className="text-amber-500" />}
            <span>{theme === 'dark' ? 'Dark Obsidian' : 'Light Slate'}</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-bg-sunken text-fg-subtle border border-border">
            Theme
          </span>
        </button>

        {/* User profile row */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface border border-border/70 shadow-sm">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-tr from-indigo-500 to-sky-500 text-white shadow-sm">
            {user?.username?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-fg truncate">
              {user?.username || 'Admin'}
            </div>
            <div className="text-[10px] text-fg-subtle font-mono truncate">
              {user?.role?.replace('_', ' ') || 'Admin'}
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Logout"
            className="p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-danger-muted/30 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
