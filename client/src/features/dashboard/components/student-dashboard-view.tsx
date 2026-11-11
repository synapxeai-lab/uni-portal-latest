import Link from "@/components/ui/link";
import { AlertCircle, Archive, BookOpen, CheckCircle2, ChevronRight, ListTodo } from "lucide-react";

import { StatCard } from "@/components/page/stat-card";
import { EmptyState } from "@/components/states/empty-state";
import { Card } from "@/components/ui/card";
import { ClassroomCard } from "@/features/classroom/components/classroom-card";
import type { ClassroomSummary } from "@/features/classroom/types";

import type { StudentDashboardData } from "../types";
import { ArchivedClassroomsSection } from "./archived-classrooms-section";
import { DashboardSection } from "./dashboard-section";
import { DashboardStatGrid } from "./dashboard-stat-grid";
import { UpcomingDeadlinesList } from "./upcoming-deadlines-list";

const CLASS_PREVIEW_LIMIT = 6;

const ATTENTION_LINKS = [
  {
    href: "/todo?tab=missing",
    label: "Missing work",
    description: "Past-due assignments you haven't turned in",
    icon: AlertCircle,
  },
  {
    href: "/todo",
    label: "Full to-do list",
    description: "Everything assigned to you, by due date",
    icon: ListTodo,
  },
  {
    href: "/todo?tab=done",
    label: "Completed work",
    description: "Turned-in and returned assignments",
    icon: CheckCircle2,
  },
] as const;

interface StudentDashboardViewProps {
  data: StudentDashboardData;
  /** The student's active classrooms, from the same query the /classes page uses. */
  classrooms: ClassroomSummary[];
}

export function StudentDashboardView({ data, classrooms }: StudentDashboardViewProps) {
  const classPreview = classrooms.slice(0, CLASS_PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-8">
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
          tone={data.missingAssignmentCount > 0 ? "danger" : "success"}
          label="Missing work"
          value={data.missingAssignmentCount}
          icon={AlertCircle}
          href="/todo?tab=missing"
        />
        <StatCard
          compact
          tone="neutral"
          label="Archived classes"
          value={data.archivedClassrooms.length}
          icon={Archive}
          href="/archived"
        />
      </DashboardStatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardSection
          title="Upcoming deadlines"
          description="Published assignments due next across your classes."
          className="lg:col-span-2"
        >
          <UpcomingDeadlinesList items={data.upcomingDeadlines} />
        </DashboardSection>

        <DashboardSection title="Needs your attention">
          <Card>
            <ul className="flex flex-col divide-y divide-border">
              {ATTENTION_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-3 px-4 py-3 text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-link dark:text-gold" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium text-foreground">{link.label}</span>
                        <span className="text-xs text-muted-foreground">{link.description}</span>
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </DashboardSection>
      </div>

      <DashboardSection
        title="Your classes"
        links={
          classrooms.length > CLASS_PREVIEW_LIMIT
            ? [{ href: "/classes", label: `View all ${classrooms.length} classes` }]
            : [{ href: "/classes", label: "All classes" }]
        }
      >
        {classPreview.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="You're not enrolled in any classes yet"
            description="Ask your teacher for a class code, then join from the Classes page."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {classPreview.map((classroom) => (
              <ClassroomCard key={classroom.id} classroom={classroom} />
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Archived classes" description="Read-only classes you were part of.">
        <ArchivedClassroomsSection classrooms={data.archivedClassrooms} />
      </DashboardSection>
    </div>
  );
}
