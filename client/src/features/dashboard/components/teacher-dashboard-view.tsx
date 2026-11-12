import {
  Archive,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileClock,
  TimerReset,
} from "lucide-react";

import { StatCard } from "@/components/page/stat-card";

import type { TeacherDashboardData } from "../types";
import { DashboardStatGrid } from "./dashboard-stat-grid";

/** The teacher's Home page: one flat grid of their classes and review queue. */
export function TeacherDashboardView({ data }: { data: TeacherDashboardData }) {
  const { reviewSummary } = data;

  return (
    <DashboardStatGrid>
      <StatCard
        compact
        tone="info"
        label="Active classes"
        value={data.activeClassroomCount}
        icon={BookOpen}
        href="/classes"
      />
      <StatCard
        compact
        tone="neutral"
        label="Archived classes"
        value={data.archivedClassroomCount}
        icon={Archive}
        href="/archived"
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
        tone="info"
        label="Recently submitted"
        value={reviewSummary.recentlySubmitted}
        icon={FileClock}
        href="/review?status=SUBMITTED&sort=newest"
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
