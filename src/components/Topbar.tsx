import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, Search, User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { NAV_BY_ROLE, roleLabel } from './navConfig';
import { NotificationBell } from './NotificationBell';

interface Props {
  onOpenMobile: () => void;
}

function usePageTitle(): string {
  const { role } = useAuth();
  const { pathname } = useLocation();
  if (!role) return '';
  const items = NAV_BY_ROLE[role];
  // Longest matching prefix wins (so /student/classes/:id → My Classes)
  const match = items
    .filter((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (pathname.startsWith('/profile')) return 'Settings';
  return match?.label ?? 'GradePulse';
}

export function Topbar({ onOpenMobile }: Props) {
  const { profile, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const title = usePageTitle();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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

        {/* Profile menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2.5 transition hover:bg-surface-3"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              {initials}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-[140px] truncate text-sm font-medium text-content">
                {profile?.full_name}
              </span>
              <span className="block text-xs uppercase tracking-wide text-content-subtle">
                {roleLabel(role)}
              </span>
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-52 origin-top-right animate-fade-in overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
              <div className="border-b border-line px-4 py-3">
                <div className="truncate text-sm font-medium text-content">
                  {profile?.full_name}
                </div>
                <div className="truncate text-xs text-content-subtle">{profile?.email}</div>
              </div>
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-content-muted hover:bg-surface-3 hover:text-content"
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-content-muted hover:bg-surface-3 hover:text-content"
              >
                <User className="h-4 w-4" /> Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
