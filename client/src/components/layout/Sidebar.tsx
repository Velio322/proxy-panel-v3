import { NavLink } from 'react-router-dom';
import { useI18n } from '@/i18n';
import {
  LayoutDashboard, Server, Users, Route, ScrollText,
  Activity, Settings, Shield, LogOut, Sun, Moon,
  Key, Network
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
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>

      {/* Brand */}
      <div className="h-16 flex items-center px-4 shrink-0 gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent)' }}>
          <Key size={16} style={{ color: 'var(--accent-fg)' }} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-widest" style={{ color: 'var(--fg)', lineHeight: '1.2' }}>
            KEEPER
          </span>
          <div className="text-[9px] font-bold tracking-widest" style={{ color: 'var(--accent)', lineHeight: '1' }}>
            CONTROL PANEL
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {/* Main Section */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--fg-subtle)' }}>
            {t('sidebar.overview')}
          </div>
          <div className="space-y-0.5">
            {nav.map((item) => {
              return (
                <NavLink key={item.to} to={item.to} onClick={onNavigate} end={item.exact}
                  className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 relative overflow-hidden group transition-all ${isActive ? 'nav-link-active' : 'hover:bg-[var(--surface-hover)]'}`}
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                  })}>
                  {({ isActive }) => (
                    <>
                      <item.icon size={15} style={{ opacity: isActive ? 1 : 0.6 }} />
                      <span className="text-[12px] flex-1 font-bold uppercase tracking-wider">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Admin Section */}
        {user?.role !== 'RESELLER' && user?.role !== 'OPERATOR' && (
          <div>
            <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--fg-subtle)' }}>
              {t('sidebar.administration')}
            </div>
            <div className="space-y-0.5">
              {admin.map((item) => {
                return (
                  <NavLink key={item.to} to={item.to} onClick={onNavigate}
                    className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 relative overflow-hidden transition-all ${isActive ? 'nav-link-active' : 'hover:bg-[var(--surface-hover)]'}`}
                    style={({ isActive }) => ({
                      color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                    })}>
                    {({ isActive }) => (
                      <>
                        <item.icon size={15} style={{ opacity: isActive ? 1 : 0.6 }} />
                        <span className="text-[12px] flex-1 font-bold uppercase tracking-wider">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 p-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Theme toggle */}
        <button onClick={toggleTheme}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13px] font-medium"
          style={{ color: 'var(--fg-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--fg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-muted)'; }}>
          {theme === 'dark'
            ? <Sun size={14} />
            : <Moon size={14} />}
          {theme === 'dark' ? 'Grey Keeper' : 'Red Keeper'}
        </button>

        {/* User row */}
        <button onClick={() => logout()}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'var(--accent-fg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg)' }}>
          {/* Avatar */}
          <div className="w-6 h-6 flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
            {user?.username?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[12px] font-semibold truncate" style={{ color: 'inherit' }}>
              {user?.username || 'Admin'}
            </div>
            <div className="text-[10px] font-medium" style={{ color: 'inherit', opacity: 0.8 }}>
              {user?.role?.replace('_', ' ') || 'Admin'}
            </div>
          </div>
          <LogOut size={13} style={{ color: 'inherit', opacity: 0.7 }} />
        </button>
      </div>
    </div>
  );
}
