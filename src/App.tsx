import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleGuard } from '@/components/RoleGuard';
import { PageSkeleton } from '@/components/Skeleton';

// Auth + shared
const Login = lazy(() => import('@/pages/auth/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('@/pages/auth/Signup').then((m) => ({ default: m.Signup })));
const ResetPassword = lazy(() =>
  import('@/pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })),
);
const Pending = lazy(() => import('@/pages/Pending').then((m) => ({ default: m.Pending })));
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));

// Student
const StudentDashboard = lazy(() =>
  import('@/pages/student/Dashboard').then((m) => ({ default: m.StudentDashboard })),
);
const StudentClasses = lazy(() =>
  import('@/pages/student/Classes').then((m) => ({ default: m.StudentClasses })),
);
const StudentClassDetails = lazy(() =>
  import('@/pages/student/ClassDetails').then((m) => ({ default: m.StudentClassDetails })),
);
const JoinClass = lazy(() =>
  import('@/pages/student/JoinClass').then((m) => ({ default: m.JoinClass })),
);
const StudentReports = lazy(() =>
  import('@/pages/student/Reports').then((m) => ({ default: m.StudentReports })),
);
const StudentAnalytics = lazy(() =>
  import('@/pages/student/Analytics').then((m) => ({ default: m.StudentAnalytics })),
);

// Teacher
const TeacherDashboard = lazy(() =>
  import('@/pages/teacher/Dashboard').then((m) => ({ default: m.TeacherDashboard })),
);
const TeacherClasses = lazy(() =>
  import('@/pages/teacher/Classes').then((m) => ({ default: m.TeacherClasses })),
);
const CreateClass = lazy(() =>
  import('@/pages/teacher/CreateClass').then((m) => ({ default: m.CreateClass })),
);
const TeacherClassDetails = lazy(() =>
  import('@/pages/teacher/ClassDetails').then((m) => ({ default: m.TeacherClassDetails })),
);
const TeacherReports = lazy(() =>
  import('@/pages/teacher/Reports').then((m) => ({ default: m.TeacherReports })),
);

// Admin
const AdminDashboard = lazy(() =>
  import('@/pages/admin/Dashboard').then((m) => ({ default: m.AdminDashboard })),
);
const AdminUsers = lazy(() =>
  import('@/pages/admin/Users').then((m) => ({ default: m.AdminUsers })),
);
const AdminSubjects = lazy(() =>
  import('@/pages/admin/Subjects').then((m) => ({ default: m.AdminSubjects })),
);
const AdminClasses = lazy(() =>
  import('@/pages/admin/Classes').then((m) => ({ default: m.AdminClasses })),
);
const AdminAuditLogs = lazy(() =>
  import('@/pages/admin/AuditLogs').then((m) => ({ default: m.AdminAuditLogs })),
);
const AdminDepartments = lazy(() =>
  import('@/pages/admin/Departments').then((m) => ({ default: m.AdminDepartments })),
);
const AdminParentLinks = lazy(() =>
  import('@/pages/admin/ParentLinks').then((m) => ({ default: m.AdminParentLinks })),
);
const AdminAppeals = lazy(() =>
  import('@/pages/admin/Appeals').then((m) => ({ default: m.AdminAppeals })),
);

// Department head + parent + shared bias signals
const DepartmentHeadDashboard = lazy(() =>
  import('@/pages/department-head/Dashboard').then((m) => ({
    default: m.DepartmentHeadDashboard,
  })),
);
const DepartmentHeadApprovals = lazy(() =>
  import('@/pages/department-head/Approvals').then((m) => ({
    default: m.DepartmentHeadApprovals,
  })),
);
const ParentDashboard = lazy(() =>
  import('@/pages/parent/Dashboard').then((m) => ({ default: m.ParentDashboard })),
);
const ParentStudentView = lazy(() =>
  import('@/pages/parent/StudentView').then((m) => ({ default: m.ParentStudentView })),
);
const BiasSignals = lazy(() =>
  import('@/pages/BiasSignals').then((m) => ({ default: m.BiasSignals })),
);

function RouteFallback() {
  return <PageSkeleton />;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/pending"
          element={
            <ProtectedRoute>
              <Pending />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Profile />} />
        </Route>

        <Route
          path="/student"
          element={
            <ProtectedRoute>
              <RoleGuard allow={['student']}>
                <Layout />
              </RoleGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="classes" element={<StudentClasses />} />
          <Route path="classes/:classId" element={<StudentClassDetails />} />
          <Route path="join" element={<JoinClass />} />
          <Route path="analytics" element={<StudentAnalytics />} />
          <Route path="reports" element={<StudentReports />} />
        </Route>

        <Route
          path="/teacher"
          element={
            <ProtectedRoute>
              <RoleGuard allow={['teacher']}>
                <Layout />
              </RoleGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="classes" element={<TeacherClasses />} />
          <Route path="classes/new" element={<CreateClass />} />
          <Route path="classes/:classId" element={<TeacherClassDetails />} />
          <Route path="reports" element={<TeacherReports />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleGuard allow={['admin']}>
                <Layout />
              </RoleGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="departments" element={<AdminDepartments />} />
          <Route path="subjects" element={<AdminSubjects />} />
          <Route path="classes" element={<AdminClasses />} />
          <Route path="parent-links" element={<AdminParentLinks />} />
          <Route path="appeals" element={<AdminAppeals />} />
          <Route path="bias-signals" element={<BiasSignals />} />
          <Route path="audit" element={<AdminAuditLogs />} />
        </Route>

        <Route
          path="/department-head"
          element={
            <ProtectedRoute>
              <RoleGuard allow={['department_head']}>
                <Layout />
              </RoleGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<DepartmentHeadDashboard />} />
          <Route path="approvals" element={<DepartmentHeadApprovals />} />
          <Route path="bias-signals" element={<BiasSignals />} />
        </Route>

        <Route
          path="/parent"
          element={
            <ProtectedRoute>
              <RoleGuard allow={['parent']}>
                <Layout />
              </RoleGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<ParentDashboard />} />
          <Route path="student/:studentId" element={<ParentStudentView />} />
        </Route>

        <Route path="/" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
