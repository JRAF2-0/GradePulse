import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/database';

interface Props {
  allow: UserRole[];
  children: ReactNode;
}

export function RoleGuard({ allow, children }: Props) {
  const { session, role, loading, profile } = useAuth();

  if (loading || (session && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-content-subtle">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allow.includes(role)) {
    if (role === 'pending') return <Navigate to="/pending" replace />;
    if (role === 'student') return <Navigate to="/student" replace />;
    if (role === 'teacher') return <Navigate to="/teacher" replace />;
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'department_head') return <Navigate to="/department-head" replace />;
    if (role === 'parent') return <Navigate to="/parent" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
