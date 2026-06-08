import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastProvider } from '@/context/ToastContext';

const COLLAPSE_KEY = 'gradepulse-sidebar-collapsed';

export function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-app">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        style={{ '--sidebar-w': collapsed ? '76px' : '256px' } as React.CSSProperties}
        className={`flex min-h-screen flex-col transition-[padding] duration-300 ${
          collapsed ? 'md:pl-[76px]' : 'md:pl-64'
        }`}
      >
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8"
        >
          <Outlet />
        </main>
      </div>
      </div>
    </ToastProvider>
  );
}
