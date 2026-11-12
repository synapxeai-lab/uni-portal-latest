import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck,
  GraduationCap,
  Megaphone,
  School,
  ShieldCheck,
  TimerReset,
  UserRound,
  Users,
} from "lucide-react";

import { StatCard } from "@/components/page/stat-card";

import type { AdminDashboardData } from "../types";
import { DashboardStatGrid } from "./dashboard-stat-grid";

/** The admin's Home page: one flat grid of platform-wide stats. */
export function AdminDashboardView({ data }: { data: AdminDashboardData }) {
  const { platformStats, reviewSummary } = data;

  return (
    <DashboardStatGrid>
      <StatCard
        compact
        tone="neutral"
        label="Total users"
        value={platformStats.totalUsers}
        icon={Users}
        href="/admin/users"
      />
      <StatCard
        compact
        tone="info"
        label="Teachers"
        value={platformStats.teacherCount}
        icon={GraduationCap}
        href="/admin/users?role=TEACHER"
      />
      <StatCard
        compact
        tone="success"
        label="Students"
        value={platformStats.studentCount}
        icon={UserRound}
        href="/admin/users?role=STUDENT"
      />
      <StatCard
        compact
        tone="gold"
        label="Admins"
        value={platformStats.adminCount}
        icon={ShieldCheck}
        href="/admin/users?role=ADMIN"
      />
      <StatCard
        compact
        tone="info"
        label="Classrooms"
        value={platformStats.classroomCount}
        icon={School}
        href="/admin/classrooms"
      />
      <StatCard
        compact
        tone="neutral"
        label="Archived classrooms"
        value={data.archivedClassroomCount}
        icon={Archive}
        href="/admin/classrooms?status=ARCHIVED"
      />
      <StatCard
        compact
        tone="danger"
        label="Assignments"
        value={platformStats.assignmentCount}
        icon={ClipboardList}
      />
      <StatCard
        compact
        tone="warning"
        label="Announcements"
        value={platformStats.announcementCount}
        icon={Megaphone}
      />
      <StatCard
        compact
        tone="success"
        label="Submissions"
        value={platformStats.submissionCount}
        icon={FileCheck}
      />
      <StatCard
        compact
        tone="warning"
        label="Pending reviews"
        value={reviewSummary.pendingReviews}
        icon={Clock}
        href="/review?status=SUBMITTED"
      />
      <StatCard
        compact
        tone="danger"
        label="Late submissions"
        value={reviewSummary.lateSubmissions}
        icon={TimerReset}
        href="/review?status=LATE"
      />
      <StatCard
        compact
        tone="success"
        label="Returned for revision today"
        value={reviewSummary.returnedToday}
        icon={CheckCircle2}
        href="/review?status=RETURNED"
      />
      <StatCard
        compact
        tone="gold"
        label="Scheduled content"
        value={data.scheduledContent.total}
        icon={CalendarClock}
      />
    </DashboardStatGrid>
  );
}
