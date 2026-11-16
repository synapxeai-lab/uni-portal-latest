import { useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck, CalendarX2, Search } from "lucide-react";

import { SearchBox } from "@/components/classic/classic";
import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { runAction, TableCard } from "@/features/academics/components/ui";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Status = "PRESENT" | "LATE" | "ABSENT";

interface Offering {
  sectionId: number;
  courseId: number;
  course: { code: string; name: string };
  section: { label: string; batch: string; department: { id: number; code: string; name: string } };
  teacher: { name: string } | null;
}

interface Register {
  /** Days attendance was taken (YYYY-MM-DD), oldest first. */
  dates: string[];
  students: { enrollmentId: number; student: { id: number; name: string; rollNo: string }; marks: Record<string, Status> }[];
}

/** What the page shows: diploma -> section -> course, and optionally one day of that course. */
interface Selection {
  diploma?: number | null;
  section?: number | null;
  course?: number | null;
  date?: string | null;
}

const BASE = "/admin/attendance/edit";

const CHOICES: { value: Status; label: string; active: string }[] = [
  { value: "PRESENT", label: "Present", active: "border-success-border bg-success-soft text-success" },
  { value: "ABSENT", label: "Absent", active: "border-destructive-border bg-destructive-soft text-destructive" },
];
// Days saved before attendance was present/absent only may still say Late.
const LATE = { value: "LATE" as Status, label: "Late", active: "border-warning-border bg-warning-soft text-warning" };

/** Today in the admin's own time zone, as YYYY-MM-DD. */
const todayIso = () => new Date().toLocaleDateString("en-CA");
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const sectionName = (o: Offering) => `${o.section.batch}-${o.section.label}`;

/** The days the teacher took, newest first, with how many were present and absent. Each opens its register. */
function DaysList({ register, onOpen }: { register: Register; onOpen: (date: string) => void }) {
  const today = todayIso();
  const days = [...register.dates].reverse().map((date) => {
    const marks = register.students.map((s) => s.marks[date]).filter(Boolean);
    return {
      date,
      present: marks.filter((m) => m === "PRESENT" || m === "LATE").length,
      absent: marks.filter((m) => m === "ABSENT").length,
      total: marks.length,
    };
  });
  if (register.students.length === 0) {
    return (
      <EmptyState icon={CalendarX2} title="No students registered yet" description="Students appear here once they register for this course." />
    );
  }
  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No attendance taken yet"
        description="The course's teacher takes attendance; days they take appear here to edit."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-base font-bold">Days taken ({days.length})</h2>
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
            {days.map((d) => (
              <TableRow key={d.date} className="cursor-pointer" onClick={() => onOpen(d.date)}>
                <TableCell className="font-medium">
                  {longDate(d.date)} {d.date === today ? <Badge variant="info">Today</Badge> : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.present}</TableCell>
                <TableCell className="text-right tabular-nums">{d.absent}</TableCell>
                <TableCell className="text-right tabular-nums">{d.total}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(d.date);
                    }}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}

/** One day's register: every registered student, marked present or absent, searchable by roll no. */
function DaySheet({
  register,
  sectionId,
  courseId,
  date,
  onBack,
}: {
  register: Register;
  sectionId: number;
  courseId: number;
  date: string;
  onBack: () => void;
}) {
  const saved = (enrollmentId: number) => register.students.find((s) => s.enrollmentId === enrollmentId)?.marks[date] ?? null;
  const [marks, setMarks] = useState<Record<number, Status>>(() =>
    Object.fromEntries(register.students.filter((s) => s.marks[date]).map((s) => [s.enrollmentId, s.marks[date]])),
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const term = search.trim().toLowerCase();
  const shown = term ? register.students.filter((s) => s.student.rollNo.toLowerCase().includes(term)) : register.students;
  // Only marks that differ from what's saved are sent.
  const changes = Object.entries(marks)
    .map(([enrollmentId, status]) => ({ enrollmentId: Number(enrollmentId), date, status }))
    .filter((c) => c.status !== saved(c.enrollmentId));
  const unmarked = register.students.filter((s) => !marks[s.enrollmentId]).length;

  async function save() {
    setSaving(true);
    const ok = await runAction(universityAction("put", `/attendance/${sectionId}/${courseId}/register`, { changes }));
    setSaving(false);
    if (ok) onBack();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft /> All days
          </Button>
          <h2 className="font-heading text-base font-bold">{longDate(date)}</h2>
        </div>
        <Button
          variant="outline"
          onClick={() => setMarks(Object.fromEntries(register.students.map((s) => [s.enrollmentId, "PRESENT" as Status])))}
        >
          Mark all present
        </Button>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Search by roll no" />
      {shown.length === 0 ? (
        <EmptyState icon={Search} title="No student with that roll no" />
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
              {shown.map((row) => {
                const current = marks[row.enrollmentId];
                const choices = current === "LATE" ? [...CHOICES, LATE] : CHOICES;
                const changed = current !== undefined && current !== saved(row.enrollmentId);
                return (
                  <TableRow key={row.enrollmentId} className={cn(changed && "bg-gold-soft hover:bg-gold-soft")}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-semibold">{row.student.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{row.student.rollNo}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div role="radiogroup" aria-label={`Attendance for ${row.student.name}`} className="flex flex-wrap gap-1.5">
                        {choices.map((choice) => {
                          const selected = current === choice.value;
                          return (
                            <button
                              key={choice.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setMarks((all) => ({ ...all, [row.enrollmentId]: choice.value }))}
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
        {unmarked > 0 ? <span className="text-sm text-muted-foreground">{unmarked} not marked</span> : null}
        {changes.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {changes.length} change{changes.length === 1 ? "" : "s"} not saved
          </span>
        ) : null}
        <Button onClick={save} disabled={saving || changes.length === 0}>
          {saving ? "Saving…" : "Save attendance"}
        </Button>
      </div>
    </div>
  );
}

/** A course section's attendance: its days, or one day's register when a date is picked. */
function CourseAttendance({
  sectionId,
  courseId,
  date,
  onDate,
}: {
  sectionId: number;
  courseId: number;
  date: string | null;
  onDate: (date: string | null) => void;
}) {
  const query = useUniversityQuery<Register>(`/attendance/${sectionId}/${courseId}/register`);
  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {(register) =>
        date && register.dates.includes(date) ? (
          // Keyed by day so another day never starts from this one's unsaved marks.
          <DaySheet key={date} register={register} sectionId={sectionId} courseId={courseId} date={date} onBack={() => onDate(null)} />
        ) : date ? (
          <EmptyState
            icon={CalendarX2}
            title="This day hasn't been taken"
            description="Only the course's teacher takes attendance. Go back and pick a day they've taken."
          />
        ) : (
          <DaysList register={register} onOpen={onDate} />
        )
      }
    </QueryView>
  );
}

/**
 * Admin: Edit attendance. Pick a diploma, one of its sections and a course of
 * that section to see the days its teacher took; open a day to change its
 * marks. Taking a new day stays the teacher's job.
 */
export default function EditAttendancePage() {
  const params = useSearchParams();
  const router = useRouter();
  const query = useUniversityQuery<{ offerings: Offering[] }>("/attendance");
  const current: Selection = {
    diploma: Number(params.get("diploma")) || null,
    section: Number(params.get("section")) || null,
    course: Number(params.get("course")) || null,
    date: params.get("date"),
  };

  // Each pick lives in the address, so Back, refresh and links from the overview all work.
  const select = (next: Selection) => {
    const search = new URLSearchParams();
    if (next.diploma) search.set("diploma", String(next.diploma));
    if (next.section) search.set("section", String(next.section));
    if (next.course) search.set("course", String(next.course));
    if (next.date) search.set("date", next.date);
    const qs = search.toString();
    // Opening a day is a step the browser's Back can undo; changing the picks isn't.
    const href = qs ? `${BASE}?${qs}` : BASE;
    if (next.date && next.date !== current.date) router.push(href);
    else router.replace(href, { scroll: false });
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Edit attendance"
        description="Pick a diploma, a section and a course to see the days its teacher took, then open a day to change its marks."
        breadcrumbs={[
          { label: "Attendance", href: "/admin/attendance" },
          { label: "Edit attendance", href: current.date ? BASE : undefined },
          ...(current.date ? [{ label: longDate(current.date) }] : []),
        ]}
      />
      <QueryView query={query} loading={<AdminLoading />}>
        {({ offerings }) => <Picker offerings={offerings} current={current} onSelect={select} />}
      </QueryView>
    </PageContainer>
  );
}

function Picker({
  offerings,
  current,
  onSelect,
}: {
  offerings: Offering[];
  current: Selection;
  onSelect: (next: Selection) => void;
}) {
  const { section: sectionId = null, course: courseId = null, date = null } = current;
  // A link straight to a section (from the overview) brings its diploma with it.
  const diplomaId = current.diploma ?? offerings.find((o) => o.sectionId === sectionId)?.section.department.id ?? null;

  const diplomas = useMemo(() => {
    const byId = new Map(offerings.map((o) => [o.section.department.id, o.section.department]));
    return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [offerings]);
  const sections = useMemo(() => {
    const byId = new Map(
      offerings.filter((o) => o.section.department.id === diplomaId).map((o) => [o.sectionId, sectionName(o)]),
    );
    return [...byId.entries()].sort((a, b) => b[1].localeCompare(a[1]));
  }, [offerings, diplomaId]);
  const courses = offerings.filter((o) => o.sectionId === sectionId);
  const offering = courses.find((o) => o.courseId === courseId) ?? null;

  if (offerings.length === 0) {
    return <EmptyState icon={CalendarCheck} title="No courses offered yet" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-diploma">Diploma</Label>
          <Select id="edit-diploma" value={diplomaId ?? ""} onChange={(e) => onSelect({ diploma: Number(e.target.value) || null })}>
            <option value="">Pick a diploma</option>
            {diplomas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-section">Section</Label>
          <Select
            id="edit-section"
            value={sectionId ?? ""}
            disabled={!diplomaId}
            onChange={(e) => onSelect({ diploma: diplomaId, section: Number(e.target.value) || null })}
          >
            <option value="">{diplomaId ? "Pick a section" : "Pick a diploma first"}</option>
            {sections.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-course">Course</Label>
          <Select
            id="edit-course"
            value={courseId ?? ""}
            disabled={!sectionId}
            onChange={(e) => onSelect({ diploma: diplomaId, section: sectionId, course: Number(e.target.value) || null })}
          >
            <option value="">{sectionId ? "Pick a course" : "Pick a section first"}</option>
            {courses.map((o) => (
              <option key={o.courseId} value={o.courseId}>
                {o.course.code} · {o.course.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {offering ? (
        <>
          <p className="text-sm text-muted-foreground">
            {offering.section.department.code} {sectionName(offering)} · {offering.course.code} {offering.course.name}
            {offering.teacher ? ` · taught by ${offering.teacher.name}` : " · no teacher assigned"}
          </p>
          <CourseAttendance
            key={`${offering.sectionId}-${offering.courseId}`}
            sectionId={offering.sectionId}
            courseId={offering.courseId}
            date={date}
            onDate={(day) => onSelect({ diploma: diplomaId, section: sectionId, course: courseId, date: day })}
          />
        </>
      ) : (
        <EmptyState
          icon={CalendarCheck}
          title="Pick a course"
          description="Choose a diploma, then a section and one of its courses to see its attendance."
        />
      )}
    </div>
  );
}
