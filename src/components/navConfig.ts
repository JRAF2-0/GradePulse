import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  BarChart3,
  FileText,
  Users,
  Building2,
  Library,
  GraduationCap,
  Gavel,
  ShieldAlert,
  Link2,
  ScrollText,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/database';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** match exactly (for index routes) instead of prefix */
  end?: boolean;
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  pending: [],
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/classes', label: 'My Classes', icon: BookOpen },
    { to: '/student/join', label: 'Join Class', icon: PlusCircle },
    { to: '/student/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/student/reports', label: 'Reports', icon: FileText },
  ],
  teacher: [
    { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/teacher/classes', label: 'My Classes', icon: BookOpen },
    { to: '/teacher/reports', label: 'Reports', icon: FileText },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/subjects', label: 'Subjects', icon: Library },
    { to: '/admin/classes', label: 'Classes', icon: GraduationCap },
    { to: '/admin/appeals', label: 'Appeals', icon: Gavel },
    { to: '/admin/bias-signals', label: 'Bias Signals', icon: ShieldAlert },
    { to: '/admin/parent-links', label: 'Parent Links', icon: Link2 },
    { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
  ],
  department_head: [
    { to: '/department-head', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/department-head/approvals', label: 'Approvals', icon: ClipboardCheck },
    { to: '/department-head/bias-signals', label: 'Bias Signals', icon: ShieldAlert },
  ],
  parent: [{ to: '/parent', label: 'Dashboard', icon: LayoutDashboard, end: true }],
};

export function homePathForRole(role: UserRole | null): string {
  if (!role || role === 'pending') return '/';
  if (role === 'department_head') return '/department-head';
  if (role === 'parent') return '/parent';
  return `/${role}`;
}

export function roleLabel(role: UserRole | null): string {
  if (role === 'department_head') return 'Department Head';
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}
