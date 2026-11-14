import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, CircleCheck, Clock, TriangleAlert, User } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { ListSkeleton } from "@/components/states/skeletons";
import { ClassicButton, StatusPill, TableEmpty } from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { ordinal } from "@/features/academics/components/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * A student's course registration: an exact replica of the old University
 * Portal's page - a list of course rows with checkboxes, a section picker per
 * course, and one Register button for everything selected.
 */

interface Section {
  id: number;
  label: string;
  teacher: { id: number; name: string } | null;
}

interface OfferedCourse {
  id: number;
  code: string;
  name: string;
  creditHours: number;
  department: { id: number; code: string; name: string; semester: number; color: string; bg: string };
  sections: Section[];
  defaultSectionId: number | null;
  registered: boolean;
  registeredSectionId: number | null;
  missed: boolean;
  failed: boolean;
  missedSemester?: number;
}

interface MyRegistration {
  registrationOpen: boolean;
  registration?: { semester: string; year: number };
  semester?: number | null;
  diploma?: { name: string } | null;
  message?: string | null;
  courses: OfferedCourse[];
  creditLimit?: number;
  creditsUsed?: number;
}

const SEMESTER_LABELS: Record<string, string> = { SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };
const teacherName = (section?: Section) => (section?.teacher ? section.teacher.name : "No teacher assigned");

/** Marks a course from an earlier semester the student never registered for, or failed. */
function GapPill({ failed, semester }: { failed: boolean; semester: number }) {
  return (
    <span
      title={
        failed
          ? `You failed this course in your ${ordinal(semester)} semester`
          : `You didn't register for this course in your ${ordinal(semester)} semester`
      }
    >
      <StatusPill tone={failed ? "error" : "warning"}>
        <TriangleAlert className="mr-1 inline size-3 align-[-2px]" aria-hidden />
        {failed ? "Failed" : "Missed"} · {ordinal(semester)} Semester
      </StatusPill>
    </span>
  );
}

const pickerBox =
  "relative flex h-10 items-center gap-[0.55rem] rounded-md border-[1.5px] border-border pl-[0.4rem] pr-[0.7rem] transition-[border-color,box-shadow]";

function SectionPicker({ course, value, onChange }: { course: OfferedCourse; value?: number; onChange: (id: number) => void }) {
  const locked = course.registered || course.sections.length <= 1;
  const current = course.sections.find((s) => s.id === value) ?? course.sections[0];
  return (
    <div className="flex w-[290px] shrink-0 flex-col gap-1 max-[720px]:order-2 max-[720px]:w-full">
      <span className="text-[0.66rem] font-bold uppercase tracking-[0.06em] text-muted-foreground">Section</span>
      {locked ? (
        <div className={cn(pickerBox, "bg-muted")} title={`Section ${current?.label} — ${teacherName(current)}`}>
          <span className="inline-flex h-[26px] min-w-7 shrink-0 items-center justify-center rounded-md bg-muted-foreground px-[0.4rem] text-[0.78rem] font-bold text-white">
            {current?.label}
          </span>
          <User className="size-[13px] shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium text-foreground">{teacherName(current)}</span>
        </div>
      ) : (
        <div
          className={cn(
            pickerBox,
            "bg-card hover:border-border-strong focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--primary-ring)]",
          )}
        >
          <span className="inline-flex h-[26px] min-w-7 shrink-0 items-center justify-center rounded-md bg-primary px-[0.4rem] text-[0.78rem] font-bold text-primary-foreground">
            {current?.label}
          </span>
          <select
            value={value ?? ""}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`Section for ${course.code}`}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          >
            {course.sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.label} — {teacherName(s)}
              </option>
            ))}
          </select>
          <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium text-foreground">{teacherName(current)}</span>
          <ChevronDown className="pointer-events-none size-[15px] shrink-0 text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  );
}

const checkboxClass = "size-[17px] shrink-0 cursor-pointer accent-primary";

export default function StudentRegistrationPage() {
  const query = useUniversityQuery<MyRegistration>("/my/registration");
  const data = query.data;
  const [selections, setSelections] = useState<Record<number, number>>({}); // courseId -> sectionId
  const [selected, setSelected] = useState<Set<number>>(new Set()); // courses ticked to register
  const [registering, setRegistering] = useState(false);

  // Seed each offered course's section choice once, keeping any the student changed.
  useEffect(() => {
    if (!data?.courses) return;
    setSelections((prev) => {
      const next = { ...prev };
      for (const c of data.courses) {
        if (next[c.id] === undefined && (c.registeredSectionId ?? c.defaultSectionId) !== null) {
          next[c.id] = (c.registeredSectionId ?? c.defaultSectionId)!;
        }
      }
      return next;
    });
  }, [data]);

  const courses = data?.courses ?? [];
  const selectable = courses.filter((c) => !c.registered);
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));
  const someSelected = selectable.some((c) => selected.has(c.id));
  const selectedCourses = courses.filter((c) => selected.has(c.id) && !c.registered);
  const selectedCredits = selectedCourses.reduce((sum, c) => sum + c.creditHours, 0);
  const creditsUsed = data?.creditsUsed ?? 0;
  const creditLimit = data?.creditLimit ?? 0;
  const willExceed = creditsUsed + selectedCredits > creditLimit;
  const showList = Boolean(data?.registrationOpen && courses.length > 0);

  const toggle = (courseId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });

  async function registerSelected() {
    if (selectedCourses.length === 0 || willExceed) return;
    setRegistering(true);
    let succeeded = 0;
    const failures: string[] = [];
    for (const course of selectedCourses) {
      const result = await universityAction("post", "/my/registration", { courseId: course.id, sectionId: selections[course.id] });
      if (result.status === "success") {
        succeeded += 1;
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(course.id);
          return next;
        });
      } else {
        failures.push(`${course.code}: ${result.message || "failed"}`);
      }
    }
    if (failures.length === 0) toast.success(`Registered for ${succeeded} course${succeeded === 1 ? "" : "s"} successfully.`);
    else if (succeeded === 0) toast.error(failures.join(" · "));
    else toast.error(`Registered ${succeeded} course(s). Failed: ${failures.join(" · ")}`);
    setRegistering(false);
  }

  const missedOutstanding = courses.filter((c) => c.missed && !c.failed && !c.registered).length;
  const failedOutstanding = courses.filter((c) => c.failed && !c.registered).length;
  const registrationLabel = data?.registration
    ? `${SEMESTER_LABELS[data.registration.semester]} ${data.registration.year} Registration`
    : "";

  return (
    <PageContainer className="gap-5">
      <SectionHeader
        title="Course Registration"
        description={
          showList
            ? `${registrationLabel}${data?.diploma && data.semester ? ` · ${ordinal(data.semester)} Semester (${data.diploma.name})` : ""} · ${creditsUsed} / ${creditLimit} credit hours used`
            : "Offered courses for your current semester appear here while registration is open."
        }
        breadcrumbs={[{ label: "Registration" }]}
        actions={
          showList ? (
            <ClassicButton
              className="shrink-0"
              disabled={selectedCourses.length === 0 || willExceed || registering}
              title={willExceed ? `Selected courses would exceed your ${creditLimit} credit hour limit` : undefined}
              onClick={registerSelected}
            >
              {registering
                ? "Registering…"
                : `Register${selectedCourses.length ? ` (${selectedCourses.length} · ${selectedCredits} CR)` : ""}`}
            </ClassicButton>
          ) : null
        }
      />

      <QueryView query={query} loading={<ListSkeleton rows={5} />}>
        {(page) =>
          !page.registrationOpen || page.courses.length === 0 ? (
            <TableEmpty icon={CalendarClock}>{page.message}</TableEmpty>
          ) : (
            <div className="flex flex-col">
              {/* No diploma this term, but courses were offered to the batch anyway. */}
              {!page.diploma && page.message ? (
                <ClassicAlertRow icon={CalendarClock} className="border-border bg-card text-mid-foreground">
                  {page.message} The courses below have been offered to your batch and can still be registered.
                </ClassicAlertRow>
              ) : null}
              {missedOutstanding > 0 ? (
                <ClassicAlertRow icon={TriangleAlert} className="border-warning-border bg-warning-soft text-warning">
                  You missed {missedOutstanding} course{missedOutstanding === 1 ? "" : "s"} from an earlier semester.{" "}
                  {missedOutstanding === 1 ? "It is" : "They are"} marked <strong>Missed</strong> below and can be registered now.
                </ClassicAlertRow>
              ) : null}
              {failedOutstanding > 0 ? (
                <ClassicAlertRow icon={TriangleAlert} className="border-destructive-border bg-destructive-soft text-destructive">
                  You failed {failedOutstanding} course{failedOutstanding === 1 ? "" : "s"} from an earlier semester.{" "}
                  {failedOutstanding === 1 ? "It is" : "They are"} marked <strong>Failed</strong> below and can be retaken now.
                </ClassicAlertRow>
              ) : null}

              {selectable.length > 1 ? (
                <label className="mb-3 ml-4 inline-flex w-fit cursor-pointer items-center gap-[0.6rem] font-medium">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.id)))}
                  />
                  Select all ({selectable.length} · {selectable.reduce((sum, c) => sum + c.creditHours, 0)} CR)
                </label>
              ) : null}

              <div className="flex flex-col gap-[0.6rem]">
                {page.courses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-[0.9rem] rounded-md border border-border bg-card px-4 py-[0.85rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-[0_2px_8px_rgba(23,31,50,.07)] max-[720px]:flex-wrap"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-[0.9rem] max-[720px]:basis-full max-[720px]:flex-wrap">
                      {c.registered ? (
                        <StatusPill tone="success">
                          <CircleCheck className="mr-1 inline size-3 align-[-2px]" aria-hidden /> Registered
                        </StatusPill>
                      ) : (
                        <input
                          type="checkbox"
                          className={checkboxClass}
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                          aria-label={`Select ${c.code} to register`}
                        />
                      )}
                      <div
                        className="shrink-0 rounded-md px-[0.55rem] py-[0.3rem] text-[0.72rem] font-bold tracking-[0.03em]"
                        style={{ color: c.department.color, background: c.department.bg }}
                      >
                        {c.code}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.87rem] font-semibold text-foreground">{c.name}</p>
                        <div className="mt-[0.2rem] flex flex-wrap items-center gap-[0.6rem]">
                          <span
                            className="inline-block max-w-full whitespace-nowrap rounded-xl px-2 py-[0.12rem] text-[0.68rem] font-bold"
                            style={{ color: c.department.color, background: c.department.bg }}
                          >
                            {c.department.name}
                          </span>
                          {c.missed && c.missedSemester ? <GapPill failed={c.failed} semester={c.missedSemester} /> : null}
                        </div>
                      </div>
                      <SectionPicker
                        course={c}
                        value={selections[c.id]}
                        onChange={(id) => setSelections((prev) => ({ ...prev, [c.id]: id }))}
                      />
                      <div className="inline-flex shrink-0 items-center gap-[0.3rem] whitespace-nowrap text-xs font-semibold text-mid-foreground max-[720px]:order-3">
                        <Clock className="size-[13px]" aria-hidden /> {c.creditHours} CR
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      </QueryView>
    </PageContainer>
  );
}

/** The old inline .alert rows above the list (info / missed / failed). */
function ClassicAlertRow({ icon: Icon, className, children }: { icon: typeof Clock; className: string; children: React.ReactNode }) {
  return (
    <div className={cn("mb-[1.1rem] flex items-center gap-2 rounded-md border px-[0.9rem] py-[0.7rem] text-sm", className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

