import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { UserRole } from "@portal/shared/enums";

import { AdminLayout, AppLayout, RoleRoute } from "./layouts";
import { NavigationBridge } from "@/lib/navigate";

import { NotFoundPage } from "./not-found-page";

// Every page is its own chunk, loaded when the route is first opened (never on
// hover). The shell, router and data layer are in the main bundle.
const LoginPage = lazy(() => import("@/pages/auth/login-page"));
const ChangePasswordPage = lazy(() => import("@/pages/account/change-password-page"));
const DashboardPage = lazy(() => import("@/pages/home/dashboard-page"));
const NotificationsPage = lazy(() => import("@/pages/home/notifications-page"));
const TodoPage = lazy(() => import("@/pages/home/todo-page"));
const ReviewPage = lazy(() => import("@/pages/home/review-page"));
const CalendarPage = lazy(() => import("@/pages/schedule/calendar-page"));
const TimetablePage = lazy(() => import("@/pages/schedule/timetable-page"));
const AdminTimetablePage = lazy(() => import("@/pages/admin/timetable-clashes-page"));
const SearchPage = lazy(() => import("@/pages/account/search-page"));
const ProfilePage = lazy(() => import("@/pages/account/profile-page"));
const SettingsPage = lazy(() => import("@/pages/account/settings-page"));
const AdminUsersPage = lazy(() => import("@/pages/admin/users-page"));
const AdminClassroomsPage = lazy(() => import("@/pages/admin/classrooms-page"));
const AdminAuditLogsPage = lazy(() => import("@/pages/admin/audit-logs-page"));
const ClassesPage = lazy(() => import("@/pages/classes/classes-page"));
const ArchivedClassesPage = lazy(() => import("@/pages/classes/archived-page"));
const ClassroomLayout = lazy(() => import("@/pages/classes/classroom-layout"));
const PeoplePage = lazy(() => import("@/pages/classes/people-page"));
const StreamPage = lazy(() => import("@/pages/classes/stream-page"));
const ClassworkPage = lazy(() => import("@/pages/classes/classwork-page"));
const AssignmentPage = lazy(() => import("@/pages/classes/assignment-page"));
const SubmissionsPage = lazy(() => import("@/pages/classes/submissions-page"));
const SubmissionReviewPage = lazy(() => import("@/pages/classes/submission-review-page"));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <NavigationBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/todo" element={<TodoPage />} />
          <Route element={<RoleRoute roles={[UserRole.TEACHER, UserRole.ADMIN]} denied="review" />}>
            <Route path="/review" element={<ReviewPage />} />
          </Route>
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/classes/:classroomId" element={<ClassroomLayout />}>
            <Route index element={<Navigate to="stream" replace />} />
            <Route path="stream" element={<StreamPage />} />
            <Route path="classwork" element={<ClassworkPage />} />
            <Route path="classwork/:assignmentId" element={<AssignmentPage />} />
            <Route path="classwork/:assignmentId/submissions" element={<SubmissionsPage />} />
            <Route
              path="classwork/:assignmentId/submissions/:studentId"
              element={<SubmissionReviewPage />}
            />
            <Route path="people" element={<PeoplePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/archived" element={<ArchivedClassesPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          {/* The admin dashboard was merged into Home, which shows admins the platform-wide view. */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="classrooms" element={<AdminClassroomsPage />} />
          <Route path="timetable" element={<AdminTimetablePage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="settings" element={<Navigate to="/settings#platform" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
