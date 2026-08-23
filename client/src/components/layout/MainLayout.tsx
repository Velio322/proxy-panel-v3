import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { Sidebar } from './Sidebar';
import { Menu, ShieldCheck, ChevronRight } from 'lucide-react';

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
    <div className="h-screen flex overflow-hidden bg-bg text-fg">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col
          lg:relative lg:translate-x-0
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Navigation Bar */}
        <header className="h-16 flex items-center justify-between px-6 shrink-0 bg-surface/80 backdrop-blur-md border-b border-border z-10">

          {/* Left section: mobile toggle + breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-xs font-medium">
              {pagePath.map((segment, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight size={14} className="text-fg-subtle" />}
                  <span
                    className={
                      i === pagePath.length - 1
                        ? 'text-fg font-semibold'
                        : 'text-fg-muted hover:text-fg transition-colors'
                    }
                  >
                    {segment}
                  </span>
                </div>
              ))}
            </nav>
          </div>

          {/* Right section: System Status indicator, quick actions */}
          <div className="flex items-center gap-3">

            {/* Master Server Online Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span className="font-mono text-[11px] font-semibold">Master Active</span>
            </div>

            {/* Security Shield Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs">
              <ShieldCheck size={14} className="text-indigo-400" />
              <span className="font-mono text-[11px]">Xray v1.8+</span>
            </div>

            {/* User Avatar */}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold bg-gradient-to-tr from-indigo-600 to-sky-400 text-white shadow-md shadow-indigo-500/20">
              {user?.username?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Page content scroll area */}
        <main className="flex-1 overflow-y-auto bg-bg/50">
          <div className="p-6 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
