import { useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus, CalendarX2 } from "lucide-react";

import { useGoBack } from "@/components/page/back-button";
import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryView } from "@/app/route-states";
import { useParams, useRouter, useSearchParams } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { FirstOfferingRedirect, OfferingPicker, PageLoading } from "@/features/academics/components/teaching-picker";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { runAction, TableCard } from "@/features/academics/components/ui";

type Status = "PRESENT" | "LATE" | "ABSENT";
const CHOICES: { value: Status; label: string; active: string }[] = [
  { value: "PRESENT", label: "Present", active: "border-success-border bg-success-soft text-success" },
  { value: "ABSENT", label: "Absent", active: "border-destructive-border bg-destructive-soft text-destructive" },
];
// Days saved before attendance was present/absent only may still say Late.
const LATE = { value: "LATE" as Status, label: "Late", active: "border-warning-border bg-warning-soft text-warning" };

interface AttendanceData {
  offering: {
    course: { code: string; name: string };
    section: { label: string; batch: string; department: { code: string } };
  };
  roster: { enrollmentId: number; student: { id: number; name: string; rollNo: string }; status: Status | null }[];
  dates: { date: Date; PRESENT: number; LATE: number; ABSENT: number; total: number }[];
}

const BASE = "/attendance";
/** Today in the teacher's own time zone, as YYYY-MM-DD. */
const todayIso = () => new Date().toLocaleDateString("en-CA");
const isoOf = (date: Date) => date.toISOString().slice(0, 10);
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** The days attendance was taken, with a button to take (or reopen) today's. */
function DaysView({ data, path }: { data: AttendanceData; path: string }) {
  const router = useRouter();
  const today = todayIso();
  const takenToday = data.dates.some((d) => isoOf(d.date) === today);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-bold">Days taken ({data.dates.length})</h2>
        <Button disabled={data.roster.length === 0} onClick={() => router.push(`${BASE}/${path}?date=${today}`)}>
          <CalendarPlus /> {takenToday ? "Edit today's attendance" : "Take today's attendance"}
        </Button>
      </div>
      {data.roster.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No students registered yet" description="Students appear here once they register for this course." />
      ) : data.dates.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No attendance yet" description="Take today's attendance to start the register." />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dates.map((d) => {
                const iso = isoOf(d.date);
                return (
                  <TableRow key={iso}>
                    <TableCell className="font-medium">
                      {longDate(iso)} {iso === today ? <Badge variant="info">Today</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.PRESENT + d.LATE}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.ABSENT}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.total}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`${BASE}/${path}?date=${iso}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}

/** One day's register: every registered student, marked present or absent. */
function DaySheet({ data, path, date }: { data: AttendanceData; path: string; date: string }) {
  const [marks, setMarks] = useState<Record<number, Status>>({});
  const [saving, setSaving] = useState(false);
  // Saved: back to where the sheet was opened from (the days list).
  const goBack = useGoBack(`${BASE}/${path}`);

  // Start from what's saved for this day.
  useEffect(() => {
    setMarks(Object.fromEntries(data.roster.filter((r) => r.status).map((r) => [r.enrollmentId, r.status!])));
  }, [data.roster]);

  const unmarked = data.roster.filter((r) => !marks[r.enrollmentId]).length;

  async function save() {
    setSaving(true);
    const ok = await runAction(
      universityAction("post", `/attendance/${path}`, {
        date,
        records: Object.entries(marks).map(([enrollmentId, status]) => ({ enrollmentId: Number(enrollmentId), status })),
      }),
    );
    setSaving(false);
    if (ok) goBack();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-bold">{longDate(date)}</h2>
        <Button
          variant="outline"
          disabled={data.roster.length === 0}
          onClick={() => setMarks(Object.fromEntries(data.roster.map((r) => [r.enrollmentId, "PRESENT" as Status])))}
        >
          Mark all present
        </Button>
      </div>
      {data.roster.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No students registered yet" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.roster.map((row) => {
                const choices = marks[row.enrollmentId] === "LATE" ? [...CHOICES, LATE] : CHOICES;
                return (
                  <TableRow key={row.enrollmentId}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-semibold">{row.student.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{row.student.rollNo}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div role="radiogroup" aria-label={`Attendance for ${row.student.name}`} className="flex flex-wrap gap-1.5">
                        {choices.map((choice) => {
                          const selected = marks[row.enrollmentId] === choice.value;
                          return (
                            <button
                              key={choice.value}
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setMarks((current) => ({ ...current, [row.enrollmentId]: choice.value }))}
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                                selected ? choice.active : "border-border text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {unmarked > 0 && data.roster.length > 0 ? (
          <span className="text-sm text-muted-foreground">{unmarked} not marked yet</span>
        ) : null}
        <Button onClick={save} disabled={saving || Object.keys(marks).length === 0}>
          {saving ? "Saving…" : "Save attendance"}
        </Button>
      </div>
    </div>
  );
}

function OfferingAttendance({ sectionId, courseId }: { sectionId: number; courseId: number }) {
  const path = `${sectionId}/${courseId}`;
  const date = useSearchParams().get("date");
  // Not keepPrevious: the day sheet must never start from another day's roster.
  const query = useUniversityQuery<AttendanceData>(`/attendance/${path}?date=${date ?? todayIso()}`);
  return (
    <QueryView query={query} loading={<PageLoading />}>
      {(data) => {
        const { course, section } = data.offering;
        return (
          <PageContainer>
            <SectionHeader
              title="Attendance"
              description={`${course.code} ${course.name} · ${section.department.code} ${section.batch}-${section.label}. Attendance is taken once per class day.`}
              breadcrumbs={[{ label: "Attendance", href: `${BASE}/${path}` }, ...(date ? [{ label: longDate(date) }] : [])]}
            />
            <OfferingPicker base={BASE} sectionId={sectionId} courseId={courseId} />
            {date ? <DaySheet data={data} path={path} date={date} /> : <DaysView data={data} path={path} />}
          </PageContainer>
        );
      }}
    </QueryView>
  );
}

/** Attendance (teachers and admins), from the sidebar. */
export default function AttendancePage() {
  const params = useParams<{ sectionId?: string; courseId?: string }>();
  if (!params.sectionId || !params.courseId) {
    return (
      <FirstOfferingRedirect base={BASE} title="Attendance" description="Take daily attendance for the course sections you teach." />
    );
  }
  return (
    <OfferingAttendance
      key={`${params.sectionId}/${params.courseId}`}
      sectionId={Number(params.sectionId)}
      courseId={Number(params.courseId)}
    />
  );
}
