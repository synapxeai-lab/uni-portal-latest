import { CheckCircle2, Clock, FileClock, TimerReset } from "lucide-react";

import { StatGrid } from "@/components/page/dashboard-grid";
import { StatCard } from "@/components/page/stat-card";

import type { ReviewQueueSummary } from "../types";

export function ReviewSummaryCards({ summary }: { summary: ReviewQueueSummary }) {
  return (
    <StatGrid>
      <StatCard
        label="Pending reviews"
        value={summary.pendingReviews}
        icon={Clock}
        hint="Submitted, not yet returned"
        href="/review?status=SUBMITTED"
      />
      <StatCard
        label="Late submissions"
        value={summary.lateSubmissions}
        icon={TimerReset}
        hint="Turned in after the due date"
        href="/review?status=LATE"
      />
      <StatCard
        label="Returned today"
        value={summary.returnedToday}
        icon={CheckCircle2}
        hint="Since midnight"
        href="/review?status=RETURNED"
      />
      <StatCard
        label="Recently submitted"
        value={summary.recentlySubmitted}
        icon={FileClock}
        hint="In the last 48 hours"
        href="/review?status=SUBMITTED&sort=newest"
      />
    </StatGrid>
  );
}
