import { useState } from "react";
import { useParams } from "react-router";
import { ChevronRight, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import Link from "@/components/ui/link";
import {
  Alert,
  BackLink,
  ClassicButton,
  ClassicModal,
  ClassicPageHeader,
  ModalActions,
  SearchBox,
  StatusPill,
  TableEmpty,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { universityAction, useDepartment, useUniversityQuery } from "@/features/academics/api";
import type { Course, Department } from "@/features/academics/types";

/**
 * A diploma's courses (admin): an exact replica of the old University
 * Portal's page - one row per course opening it, and "Add Course" to add any
 * existing course (a copy with the same code) to this diploma.
 */

const rowClass =
  "flex items-center gap-[0.9rem] rounded-md border border-border bg-card px-4 py-[0.85rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-[0_2px_8px_rgba(23,31,50,.07)] max-[720px]:flex-wrap";

function CodeBadge({ code, department }: { code: string; department: Pick<Department, "color" | "bg"> }) {
  return (
    <div
      className="shrink-0 rounded-md px-[0.55rem] py-[0.3rem] text-[0.72rem] font-bold tracking-[0.03em]"
      style={{ color: department.color, background: department.bg }}
    >
      {code}
    </div>
  );
}

function Credits({ hours }: { hours: number }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-[0.3rem] whitespace-nowrap text-xs font-semibold text-mid-foreground">
      <Clock className="size-[13px]" aria-hidden /> {hours} CR
    </div>
  );
}

/** Lists every course not yet in this diploma (once per code) and adds a copy of the picked one. */
function AddExistingCourseModal({ department, onClose }: { department: Department; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [apiErr, setApiErr] = useState("");
  const query = useUniversityQuery<{ courses: Course[] }>("/courses");
  const taken = new Set(department.courses.map((c) => c.code));

  const byCode = new Map<string, { course: Course; programmes: string[] }>();
  for (const c of query.data?.courses ?? []) {
    if (taken.has(c.code)) continue;
    const entry = byCode.get(c.code);
    if (entry) entry.programmes.push(c.department?.name ?? "");
    else byCode.set(c.code, { course: c, programmes: [c.department?.name ?? ""] });
  }
  const q = search.trim().toLowerCase();
  const options = [...byCode.values()]
    .filter(({ course }) => !q || course.name.toLowerCase().includes(q) || course.code.toLowerCase().includes(q))
    .sort((a, b) => a.course.code.localeCompare(b.course.code, undefined, { numeric: true }));

  async function add(course: Course) {
    setAddingId(course.id);
    setApiErr("");
    const result = await universityAction("post", `/courses/${course.id}/copy`, { departmentId: department.id });
    setAddingId(null);
    if (result.status !== "success") return setApiErr(result.message || "Failed to add course.");
    toast.success(`${course.name} added to ${department.name}.`);
  }

  return (
    <ClassicModal open onClose={onClose} title={`Add Course to ${department.name}`} width={600}>
      {apiErr ? <Alert>{apiErr}</Alert> : null}
      <div className="mb-[0.9rem] flex">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by course name or code…" />
      </div>
      <div className="flex max-h-[55vh] flex-col gap-[0.6rem] overflow-y-auto">
        {query.isPending ? (
          <TableEmpty>Loading courses…</TableEmpty>
        ) : options.length === 0 ? (
          <TableEmpty>{q ? "No courses match your search." : "Every course is already in this programme."}</TableEmpty>
        ) : (
          options.map(({ course, programmes }) => (
            <div key={course.code} className={rowClass}>
              <CodeBadge code={course.code} department={department} />
              <div className="min-w-0 flex-1">
                <p className="text-[0.87rem] font-semibold text-foreground">{course.name}</p>
                <p className="mt-[0.15rem] truncate text-xs text-muted-foreground" title={programmes.join(", ")}>
                  In {programmes.join(", ")}
                </p>
              </div>
              <Credits hours={course.creditHours} />
              <ClassicButton className="shrink-0 px-[0.85rem] py-[0.45rem] text-[0.82rem]" onClick={() => add(course)} disabled={addingId !== null}>
                <Plus className="size-3.5" /> {addingId === course.id ? "Adding…" : "Add"}
              </ClassicButton>
            </div>
          ))
        )}
      </div>
      <ModalActions>
        <ClassicButton variant="outline" onClick={onClose}>
          Done
        </ClassicButton>
      </ModalActions>
    </ClassicModal>
  );
}

export default function DiplomaCoursesPage() {
  const id = Number(useParams().id);
  const query = useDepartment(id);
  const [adding, setAdding] = useState(false);
  const department = query.data?.department;

  return (
    <PageContainer className="gap-0">
      <BackLink fallback={`/admin/diplomas/${id}`}>Back to {department?.name ?? "diploma"}</BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={5} />}>
          {({ department: d }) => (
            <>
              <ClassicPageHeader
                title="Courses"
                subtitle={`${d.name} · ${d.courses.length} courses`}
                action={
                  <ClassicButton onClick={() => setAdding(true)}>
                    <Plus className="size-4" /> Add Course
                  </ClassicButton>
                }
              />
              {d.courses.length === 0 ? (
                <TableEmpty>No courses in this diploma yet.</TableEmpty>
              ) : (
                <div className="mb-6 flex flex-col gap-[0.6rem]">
                  {d.courses.map((c) => (
                    <Link key={c.id} href={`/admin/courses/${c.id}`} className={rowClass}>
                      <CodeBadge code={c.code} department={d} />
                      <div className="min-w-0 flex-1 max-[720px]:order-1 max-[720px]:basis-full">
                        <p className="text-[0.87rem] font-semibold text-foreground">{c.name}</p>
                      </div>
                      <span className="max-[720px]:order-2">
                        <StatusPill tone={c.status === "ACTIVE" ? "success" : "muted"}>{c.status === "ACTIVE" ? "Active" : "Inactive"}</StatusPill>
                      </span>
                      <span className="max-[720px]:order-3">
                        <Credits hours={c.creditHours} />
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-border-strong max-[720px]:order-4" aria-hidden />
                    </Link>
                  ))}
                </div>
              )}
              {adding ? <AddExistingCourseModal department={d} onClose={() => setAdding(false)} /> : null}
            </>
          )}
        </QueryView>
      </div>
    </PageContainer>
  );
}
