import { Menu, Moon, Sun, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { NAV_BY_ROLE } from './navConfig';
import { NotificationBell } from './NotificationBell';

interface Props {
  onOpenMobile: () => void;
}

function usePageTitle(): string {
  const { role } = useAuth();
  const { pathname } = useLocation();
  if (!role) return '';
  if (pathname.startsWith('/profile')) return 'Settings';
  const items = NAV_BY_ROLE[role];
  // Longest matching prefix wins (so /student/classes/:id → My Classes)
  const match = items
    .filter((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? 'GradePulse';
}

export function Topbar({ onOpenMobile }: Props) {
  const { theme, toggleTheme } = useTheme();
  const title = usePageTitle();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-app/80 px-4 backdrop-blur-xl md:px-6">
      <button
        onClick={onOpenMobile}
        className="rounded-lg p-2 text-content-muted hover:bg-surface-3 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-content">{title}</h1>
      </div>

      {/* Search (visual; wiring comes in a later phase) */}
      <div className="ml-auto hidden items-center lg:flex">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
          <input
            type="search"
            placeholder="Search…"
            className="w-56 rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 lg:ml-3">
        <button
          onClick={toggleTheme}
          className="rounded-xl p-2.5 text-content-muted transition hover:bg-surface-3 hover:text-content"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <NotificationBell />
      </div>
    </header>
  );
}
