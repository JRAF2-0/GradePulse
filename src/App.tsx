import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleGuard } from '@/components/RoleGuard';

import { Login } from '@/pages/auth/Login';
import { Signup } from '@/pages/auth/Signup';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { Pending } from '@/pages/Pending';
import { Profile } from '@/pages/Profile';

import { StudentDashboard } from '@/pages/student/Dashboard';
import { StudentClasses } from '@/pages/student/Classes';
import { StudentClassDetails } from '@/pages/student/ClassDetails';
import { JoinClass } from '@/pages/student/JoinClass';
import { StudentReports } from '@/pages/student/Reports';
import { StudentAnalytics } from '@/pages/student/Analytics';

import { TeacherDashboard } from '@/pages/teacher/Dashboard';
import { TeacherClasses } from '@/pages/teacher/Classes';
import { CreateClass } from '@/pages/teacher/CreateClass';
import { TeacherClassDetails } from '@/pages/teacher/ClassDetails';
import { TeacherReports } from '@/pages/teacher/Reports';

import { AdminDashboard } from '@/pages/admin/Dashboard';
import { AdminUsers } from '@/pages/admin/Users';
import { AdminSubjects } from '@/pages/admin/Subjects';
import { AdminClasses } from '@/pages/admin/Classes';
import { AdminAuditLogs } from '@/pages/admin/AuditLogs';
import { AdminDepartments } from '@/pages/admin/Departments';
import { AdminParentLinks } from '@/pages/admin/ParentLinks';
import { AdminAppeals } from '@/pages/admin/Appeals';

import { DepartmentHeadDashboard } from '@/pages/department-head/Dashboard';
import { DepartmentHeadApprovals } from '@/pages/department-head/Approvals';
import { ParentDashboard } from '@/pages/parent/Dashboard';
import { ParentStudentView } from '@/pages/parent/StudentView';
import { BiasSignals } from '@/pages/BiasSignals';

export default function App() {
  return (
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
  );
}
