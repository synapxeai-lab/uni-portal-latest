import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX2 } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClassroomTabLoading, useCurrentClassroom } from "@/pages/classes/classroom-layout";
import { QueryView } from "@/app/route-states";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { runAction, TableCard } from "@/features/academics/components/ui";
import { cn } from "@/lib/utils";

type Status = "PRESENT" | "LATE" | "ABSENT";
const STATUSES: { value: Status; label: string; active: string }[] = [
  { value: "PRESENT", label: "Present", active: "border-success-border bg-success-soft text-success" },
  { value: "LATE", label: "Late", active: "border-warning-border bg-warning-soft text-warning" },
  { value: "ABSENT", label: "Absent", active: "border-destructive-border bg-destructive-soft text-destructive" },
];
const BADGE: Record<Status, "success" | "warning" | "destructive"> = { PRESENT: "success", LATE: "warning", ABSENT: "destructive" };

interface AttendancePage {
  roster: { enrollmentId: number; student: { id: number; name: string; rollNo: string }; status: Status | null }[];
  dates: { date: Date; PRESENT: number; LATE: number; ABSENT: number; total: number }[];
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const longDate = (date: Date) => date.toLocaleDateString(undefined, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Teacher/admin: take a day's attendance; the history of days taken alongside. */
function TakeAttendance({ sectionId, courseId }: { sectionId: number; courseId: number }) {
  const [date, setDate] = useState(todayIso());
  const query = useUniversityQuery<AttendancePage>(`/attendance/${sectionId}/${courseId}?date=${date}`, { keepPrevious: true });
  const [marks, setMarks] = useState<Record<number, Status>>({});
  const [saving, setSaving] = useState(false);

  // Start from what's saved for the chosen day.
  useEffect(() => {
    setMarks(Object.fromEntries((query.data?.roster ?? []).filter((r) => r.status).map((r) => [r.enrollmentId, r.status!])));
  }, [query.data]);

  return (
    <QueryView query={query} loading={<ClassroomTabLoading />}>
      {({ roster, dates }) => (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Class day
                <Input type="date" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={roster.length === 0}
                  onClick={() => setMarks(Object.fromEntries(roster.map((r) => [r.enrollmentId, "PRESENT" as Status])))}
                >
                  All present
                </Button>
                <Button
                  disabled={saving || Object.keys(marks).length === 0}
                  onClick={async () => {
                    setSaving(true);
                    await runAction(
                      universityAction("post", `/attendance/${sectionId}/${courseId}`, {
                        date,
                        records: Object.entries(marks).map(([enrollmentId, status]) => ({ enrollmentId: Number(enrollmentId), status })),
                      }),
                    );
                    setSaving(false);
                  }}
                >
                  {saving ? "Saving…" : "Save attendance"}
                </Button>
              </div>
            </div>
            {roster.length === 0 ? (
              <EmptyState icon={CalendarX2} title="No students registered yet" description="Students appear here once they register for this course." />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((row) => (
                      <TableRow key={row.enrollmentId}>
                        <TableCell>
                          <span className="flex flex-col">
                            <span className="font-semibold">{row.student.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{row.student.rollNo}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <div role="radiogroup" aria-label={`Attendance for ${row.student.name}`} className="flex flex-wrap gap-1.5">
                            {STATUSES.map((status) => {
                              const selected = marks[row.enrollmentId] === status.value;
                              return (
                                <button
                                  key={status.value}
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => setMarks((current) => ({ ...current, [row.enrollmentId]: status.value }))}
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                                    selected ? status.active : "border-border text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  {status.label}
                                </button>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
          </div>
          <Card className="flex h-fit flex-col gap-2 p-4">
            <h3 className="text-sm font-bold">Days taken ({dates.length})</h3>
            {dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance yet.</p>
            ) : (
              <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                {dates.map((d) => {
                  const iso = d.date.toISOString().slice(0, 10);
                  return (
                    <li key={iso}>
                      <button
                        onClick={() => setDate(iso)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                          iso === date && "bg-accent",
                        )}
                      >
                        <span>{longDate(d.date)}</span>
                        <span className="text-xs text-muted-foreground">
                          {d.PRESENT + d.LATE}/{d.total}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </QueryView>
  );
}

interface MyAttendance {
  groups: {
    courses: {
      id: number;
      section: { id: number };
      summary: { present: number; late: number; absent: number; total: number; percentage: number | null };
      records: { date: Date; status: Status }[];
    }[];
  }[];
}

/** Student: their own attendance in this course. */
function MyCourseAttendance({ sectionId, courseId }: { sectionId: number; courseId: number }) {
  const query = useUniversityQuery<MyAttendance>("/my/attendance");
  return (
    <QueryView query={query} loading={<ClassroomTabLoading />}>
      {({ groups }) => {
        const course = groups.flatMap((g) => g.courses).find((c) => c.id === courseId && c.section.id === sectionId);
        if (!course || course.summary.total === 0) {
          return <EmptyState icon={CalendarCheck} title="No attendance recorded yet" />;
        }
        const { summary } = course;
        return (
          <div className="flex flex-col gap-4">
            <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <Stat label="Attendance" value={`${summary.percentage}%`} />
              <Stat label="Present" value={summary.present} />
              <Stat label="Late" value={summary.late} />
              <Stat label="Absent" value={summary.absent} />
            </Card>
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...course.records].reverse().map((record) => (
                    <TableRow key={record.date.toISOString()}>
                      <TableCell>{longDate(record.date)}</TableCell>
                      <TableCell>
                        <Badge variant={BADGE[record.status]}>{record.status.charAt(0) + record.status.slice(1).toLowerCase()}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </div>
        );
      }}
    </QueryView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

/** /classes/:id/attendance - only for the classroom of a course offering. */
export default function ClassroomAttendancePage() {
  const classroom = useCurrentClassroom();
  if (!classroom.offering) {
    return <EmptyState icon={CalendarX2} title="Attendance is kept for university courses only" />;
  }
  const { sectionId, courseId } = classroom.offering;
  return classroom.role === "STUDENT" ? (
    <MyCourseAttendance sectionId={sectionId} courseId={courseId} />
  ) : (
    <TakeAttendance sectionId={sectionId} courseId={courseId} />
  );
}
