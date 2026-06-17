import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { Sidebar } from './Sidebar';
import { Menu, Bell, Search, ChevronRight } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/':           'nav.dashboard',
  '/nodes':      'nav.nodes',
  '/inbounds':   'nav.inbounds',
  '/clients':    'nav.clients',
  '/monitoring': 'nav.monitoring',
  '/routing':    'nav.routing',
  '/plans':      'nav.plans',
  '/users':      'nav.users',
  '/audit':      'nav.audit',
  '/settings':   'nav.settings',
};

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuthStore();

  const titleKey = PAGE_TITLES[location.pathname] || '';
  const pageTitle = titleKey ? t(titleKey) : location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2);
  const pagePath = location.pathname === '/' ? ['Dashboard'] : ['Dashboard', pageTitle];

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-56 flex flex-col
          lg:relative lg:translate-x-0
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ borderRight: '1px solid var(--border)' }}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="h-13 flex items-center px-4 gap-3 shrink-0"
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            height: '52px',
          }}>

          {/* Mobile menu btn */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-md"
            style={{ color: 'var(--fg-muted)' }}>
            <Menu size={17} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[13px]">
            {pagePath.map((segment, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={11} style={{ color: 'var(--fg-subtle)' }} />}
                <span
                  style={{
                    color: i === pagePath.length - 1 ? 'var(--fg)' : 'var(--fg-muted)',
                    fontWeight: i === pagePath.length - 1 ? 600 : 400,
                  }}>
                  {segment}
                </span>
              </span>
            ))}
          </div>

          <div className="flex-1" />

          {/* Right controls */}
          <div className="flex items-center gap-1">

            {/* Search hint */}
            <div
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                color: 'var(--fg-subtle)',
              }}>
              <Search size={13} />
              <span>Search...</span>
              <kbd className="px-1 py-0.5 rounded text-[10px] font-mono"
                style={{ background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>
                ⌘K
              </kbd>
            </div>

            {/* Notifications */}
            <button
              className="relative p-2 rounded-md"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--fg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-muted)'; }}>
              <Bell size={16} />
              <span className="notif-dot" />
            </button>

            {/* User avatar */}
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold ml-1"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                color: '#fff',
                boxShadow: '0 2px 6px var(--accent-glow)',
              }}>
              {user?.username?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-[1440px] mx-auto animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
