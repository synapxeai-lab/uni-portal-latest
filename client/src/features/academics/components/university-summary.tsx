import {
  Backpack,
  BookMarked,
  CalendarCheck,
  CalendarClock,
  GraduationCap,
  Layers,
  Library,
  Presentation,
  Receipt,
  UserRoundX,
} from "lucide-react";

import { StatCard } from "@/components/page/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { DashboardStatGrid } from "@/features/dashboard/components/dashboard-stat-grid";

import { useUniversityQuery } from "../api";
import { formatRs, ordinal } from "./ui";

interface Periods {
  semester: { semester: string; year: number; semesterStart: Date | null; semesterEnd: Date | null } | null;
  registration: { semester: string; year: number; startDate: Date; endDate: Date; status: string } | null;
}
type Summary =
  | (Periods & {
      role: "ADMIN";
      counts: { teachers: number; students: number; programmes: number; diplomas: number; courses: number; offerings: number; unassigned: number };
      fees: { pendingApprovals: number; unpaidAmount: number };
    })
  | (Periods & {
      role: "TEACHER";
      teaching: {
        course: { code: string; name: string; creditHours: number };
        section: { label: string; batch: string; department: { code: string } };
        classroomId: string | null;
        students: number;
      }[];
    })
  | (Periods & {
      role: "STUDENT";
      profile: { rollNo: string; batch: string; section: string; semester: number | null; diploma: { name: string; code: string } | null } | null;
      registeredCredits: number | null;
      cgpa: number | null;
      attendance: number | null;
      fees: { due: number; awaitingApproval: boolean };
    });

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const day = (value: Date) => value.toLocaleDateString(undefined, { dateStyle: "medium" });

/** The current term and registration window, shown to every role. */
function TermBanner({ semester, registration, registerHref }: Periods & { registerHref?: string }) {
  const open = registration?.status === "ACTIVE";
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-5 w-5 text-muted-foreground" aria-hidden />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">
            {semester ? `${titleCase(semester.semester)} ${semester.year} semester` : "No semester running"}
          </span>
          <span className="text-xs text-muted-foreground">
            {registration
              ? `Registration for ${titleCase(registration.semester)} ${registration.year}: ${day(registration.startDate)} - ${day(registration.endDate)}`
              : "No registration scheduled"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {registration ? (
          <Badge variant={open ? "success" : registration.status === "UPCOMING" ? "info" : "secondary"}>
            Registration {open ? "open" : titleCase(registration.status)}
          </Badge>
        ) : null}
        {open && registerHref ? (
          <Button size="sm" asChild>
            <Link href={registerHref}>Register</Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** University section of the dashboard: term, and the role's own academic numbers. */
export function UniversitySummary() {
  const summary = useUniversityQuery<Summary>("/university/summary").data;
  if (!summary) {
    return null;
  }

  if (summary.role === "ADMIN") {
    const { counts, fees } = summary;
    return (
      <DashboardSection title="University">
        <div className="flex flex-col gap-4">
          <TermBanner {...summary} />
          <DashboardStatGrid>
            <StatCard compact label="Students" value={counts.students} icon={Backpack} href="/admin/students" />
            <StatCard compact tone="info" label="Teachers" value={counts.teachers} icon={Presentation} href="/admin/teachers" />
            <StatCard compact tone="neutral" label="Diplomas" value={counts.diplomas} icon={Layers} hint={`${counts.programmes} programmes`} href="/admin/programmes" />
            <StatCard compact tone="neutral" label="Courses" value={counts.courses} icon={Library} hint={`${counts.offerings} section offerings`} href="/admin/courses" />
            <StatCard
              compact
              tone={counts.unassigned ? "warning" : "success"}
              label="Without a teacher"
              value={counts.unassigned}
              icon={UserRoundX}
              href="/admin/assign-teachers"
            />
            <StatCard
              compact
              tone={fees.pendingApprovals ? "warning" : "success"}
              label="Payments to approve"
              value={fees.pendingApprovals}
              icon={Receipt}
              hint={`${formatRs(fees.unpaidAmount)} unpaid`}
              href="/admin/fees"
            />
          </DashboardStatGrid>
        </div>
      </DashboardSection>
    );
  }

  if (summary.role === "TEACHER") {
    return (
      <DashboardSection title="Teaching this term">
        <div className="flex flex-col gap-4">
          <TermBanner {...summary} />
          {summary.teaching.length === 0 ? (
            <p className="text-sm text-muted-foreground">You aren't assigned to any course sections yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {summary.teaching.map((t) => (
                <Card key={`${t.course.code}-${t.section.batch}-${t.section.label}`} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col">
                    <span className="font-semibold">{t.course.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.course.code} · {t.section.department.code} {t.section.batch}-{t.section.label} · {t.students} students
                    </span>
                  </div>
                  {t.classroomId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/classes/${t.classroomId}/stream`}>Classroom</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/classes/${t.classroomId}/attendance`}>Attendance</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/classes/${t.classroomId}/marks`}>Marks</Link>
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardSection>
    );
  }

  const { profile } = summary;
  return (
    <DashboardSection title="My studies">
      <div className="flex flex-col gap-4">
        <TermBanner {...summary} registerHref={profile ? "/registration" : undefined} />
        {profile ? (
          <DashboardStatGrid>
            <StatCard
              compact
              label="Current diploma"
              value={profile.diploma?.code ?? "-"}
              icon={GraduationCap}
              hint={profile.semester ? `${ordinal(profile.semester)} semester · batch ${profile.batch}-${profile.section}` : `Batch ${profile.batch}`}
              href="/my-courses"
            />
            <StatCard
              compact
              tone="info"
              label="Credits registered"
              value={summary.registeredCredits ?? "-"}
              icon={BookMarked}
              href="/registration"
            />
            <StatCard
              compact
              tone={summary.attendance === null ? "neutral" : summary.attendance >= 75 ? "success" : "danger"}
              label="Attendance"
              value={summary.attendance === null ? "-" : `${summary.attendance}%`}
              icon={CalendarCheck}
              href="/my-attendance"
            />
            <StatCard
              compact
              tone="neutral"
              label="CGPA"
              value={summary.cgpa === null ? "-" : summary.cgpa.toFixed(2)}
              icon={GraduationCap}
              href="/transcript"
            />
            <StatCard
              compact
              tone={summary.fees.due ? "warning" : "success"}
              label="Fee due"
              value={formatRs(summary.fees.due)}
              icon={Receipt}
              hint={summary.fees.awaitingApproval ? "A payment is awaiting approval" : undefined}
              href="/fee-challan"
            />
          </DashboardStatGrid>
        ) : (
          <p className="text-sm text-muted-foreground">No student record is linked to your account yet. Contact an administrator.</p>
        )}
      </div>
    </DashboardSection>
  );
}
