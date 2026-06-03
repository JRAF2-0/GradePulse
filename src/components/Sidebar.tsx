import { Link, NavLink } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NAV_BY_ROLE, homePathForRole, roleLabel } from './navConfig';
import { Logo } from './Logo';

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  const { role } = useAuth();
  const items = role ? NAV_BY_ROLE[role] : [];
  const home = homePathForRole(role);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface',
          'transition-[transform,width] duration-300 ease-in-out',
          collapsed ? 'w-[76px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-4">
          <Link
            to={home}
            className="flex items-center gap-2 overflow-hidden"
            onClick={onCloseMobile}
          >
            <Logo size="sm" withWordmark={!collapsed} />
          </Link>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-3 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onCloseMobile}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    collapsed ? 'justify-center' : '',
                    isActive
                      ? 'bg-brand-600/10 text-brand-500 ring-1 ring-brand-500/20'
                      : 'text-content-muted hover:bg-surface-3 hover:text-content',
                  ].join(' ')
                }
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer: role + collapse toggle */}
        <div className="border-t border-line p-3">
          {!collapsed && role && (
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-content-subtle">
              {roleLabel(role)} workspace
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className={[
              'hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-content-muted transition hover:bg-surface-3 hover:text-content md:flex',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={`h-5 w-5 shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              strokeWidth={1.8}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
