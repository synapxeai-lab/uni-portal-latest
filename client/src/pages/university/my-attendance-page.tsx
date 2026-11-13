import { CalendarCheck, CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useParams, useRouter } from "@/lib/navigation";
import { useUniversityQuery } from "@/features/academics/api";
import { TableCard } from "@/features/academics/components/ui";

type Status = "PRESENT" | "LATE" | "ABSENT";

interface Course {
  enrollmentId: number;
  code: string;
  name: string;
  section: { label: string };
  summary: { present: number; late: number; absent: number; total: number; percentage: number | null };
  records: { date: Date; status: Status }[];
}

interface MyAttendance {
  groups: { semester: string; year: number; courses: Course[] }[];
}

const BASE = "/my-attendance";
const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const rateVariant = (p: number | null) => (p === null ? "secondary" : p >= 75 ? "success" : p >= 60 ? "warning" : "destructive");
const STATUS: Record<Status, { label: string; variant: "success" | "warning" | "destructive" }> = {
  PRESENT: { label: "Present", variant: "success" },
  LATE: { label: "Late", variant: "warning" },
  ABSENT: { label: "Absent", variant: "destructive" },
};
// Attendance days are stored as UTC midnight; show them as that calendar day.
const formatDay = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString(undefined, { timeZone: "UTC", ...options });

function RateBadge({ percentage }: { percentage: number | null }) {
  return <Badge variant={rateVariant(percentage)}>{percentage === null ? "Not taken yet" : `${percentage}%`}</Badge>;
}

/** Every course, by term, with its attendance rate. A row opens its day-by-day history. */
function CoursesView({ groups }: MyAttendance) {
  const router = useRouter();
  if (groups.length === 0) return <EmptyState icon={CalendarCheck} title="No courses yet" />;
  return groups.map((group) => (
    <div key={`${group.semester}-${group.year}`} className="flex flex-col gap-2">
      <h2 className="font-heading text-base font-bold">
        {titleCase(group.semester)} {group.year}
      </h2>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.courses.map((course) => (
              <TableRow
                key={course.enrollmentId}
                className="cursor-pointer"
                onClick={() => router.push(`${BASE}/${course.enrollmentId}`)}
              >
                <TableCell>
                  <Link href={`${BASE}/${course.enrollmentId}`} className="flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <span className="font-semibold">{course.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {course.code} · Section {course.section.label}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{course.summary.present + course.summary.late}</TableCell>
                <TableCell className="text-right tabular-nums">{course.summary.absent}</TableCell>
                <TableCell>
                  <RateBadge percentage={course.summary.percentage} />
                </TableCell>
                <TableCell>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  ));
}

/** One course's attendance, date by date, newest first. */
function HistoryView({ course }: { course: Course }) {
  const attended = course.summary.present + course.summary.late;
  const days = [...course.records].sort((a, b) => b.date.getTime() - a.date.getTime());
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <Link href={BASE}>
              <ChevronLeft /> All courses
            </Link>
          </Button>
          <h2 className="font-heading text-base font-bold">
            {course.code} {course.name} · Section {course.section.label}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {attended} / {course.summary.total} days attended
          </span>
          <RateBadge percentage={course.summary.percentage} />
        </div>
      </div>
      {days.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No attendance yet" description="Days appear here once your teacher takes attendance." />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((record) => (
                <TableRow key={record.date.getTime()}>
                  <TableCell className="font-medium tabular-nums">
                    {formatDay(record.date, { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell>{formatDay(record.date, { weekday: "long" })}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS[record.status].variant}>{STATUS[record.status].label}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}

/** A student's attendance in every course, by term, and each course's date-wise history. */
export default function MyAttendancePage() {
  const { enrollmentId } = useParams<{ enrollmentId?: string }>();
  const query = useUniversityQuery<MyAttendance>("/my/attendance");
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ groups }) => {
        const course = enrollmentId
          ? groups.flatMap((g) => g.courses).find((c) => c.enrollmentId === Number(enrollmentId))
          : undefined;
        return (
          <PageContainer>
            <SectionHeader
              title="Attendance"
              description="Keep each course at 75% or above. Open a course to see every day's attendance."
              breadcrumbs={[{ label: "Attendance", href: BASE }, ...(course ? [{ label: course.code }] : [])]}
            />
            {enrollmentId ? (
              course ? (
                <HistoryView course={course} />
              ) : (
                <EmptyState icon={CalendarX2} title="Course not found" description="It isn't one of your registered courses." />
              )
            ) : (
              <CoursesView groups={groups} />
            )}
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
