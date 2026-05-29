import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/database';
import { NotificationBell } from './NotificationBell';
import { Logo } from './Logo';

interface NavItem {
  to: string;
  label: string;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  pending: [],
  student: [
    { to: '/student', label: 'Dashboard' },
    { to: '/student/classes', label: 'My Classes' },
    { to: '/student/analytics', label: 'Analytics' },
    { to: '/student/join', label: 'Join Class' },
    { to: '/student/reports', label: 'Reports' },
  ],
  teacher: [
    { to: '/teacher', label: 'Dashboard' },
    { to: '/teacher/classes', label: 'My Classes' },
    { to: '/teacher/reports', label: 'Reports' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/departments', label: 'Departments' },
    { to: '/admin/subjects', label: 'Subjects' },
    { to: '/admin/classes', label: 'Classes' },
    { to: '/admin/appeals', label: 'Appeals' },
    { to: '/admin/bias-signals', label: 'Bias Signals' },
    { to: '/admin/parent-links', label: 'Parent Links' },
    { to: '/admin/audit', label: 'Audit Logs' },
  ],
  department_head: [
    { to: '/department-head', label: 'Dashboard' },
    { to: '/department-head/approvals', label: 'Approvals' },
    { to: '/department-head/bias-signals', label: 'Bias Signals' },
  ],
  parent: [{ to: '/parent', label: 'Dashboard' }],
};

function homePathForRole(role: UserRole | null): string {
  if (!role || role === 'pending') return '/';
  if (role === 'department_head') return '/department-head';
  if (role === 'parent') return '/parent';
  return `/${role}`;
}

export function Layout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const items = role ? NAV_BY_ROLE[role] : [];
  const homeHref = homePathForRole(role);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to={homeHref} className="transition hover:opacity-90">
            <Logo size="sm" withWordmark />
          </Link>
          <nav className="hidden gap-1 md:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === homeHref}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link
              to="/profile"
              className="hidden text-right transition hover:opacity-80 md:block"
              title="Edit profile"
            >
              <div className="text-sm font-medium text-slate-900">{profile?.full_name}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{role}</div>
            </Link>
            <button onClick={handleSignOut} className="btn-secondary">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
