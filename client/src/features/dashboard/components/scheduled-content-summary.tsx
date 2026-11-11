import { CalendarClock, ClipboardList, FileText, Megaphone } from "lucide-react";

import { StatGrid } from "@/components/page/dashboard-grid";
import { StatCard } from "@/components/page/stat-card";
import type { ScheduledContentStats } from "@/features/scheduling/types";

/** Reused by both the Teacher dashboard (scoped) and the Admin dashboard (platform-wide). */
export function ScheduledContentSummary({ stats }: { stats: ScheduledContentStats }) {
  return (
    <StatGrid>
      <StatCard label="Scheduled total" value={stats.total} icon={CalendarClock} />
      <StatCard label="Announcements" value={stats.announcementCount} icon={Megaphone} />
      <StatCard label="Assignments" value={stats.assignmentCount} icon={ClipboardList} />
      <StatCard label="Materials" value={stats.materialCount} icon={FileText} />
    </StatGrid>
  );
}
