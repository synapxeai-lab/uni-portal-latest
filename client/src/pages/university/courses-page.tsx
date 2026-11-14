import { useState } from "react";
import { ChevronRight, ClipboardList, Clock, Pencil, Plus, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import Link from "@/components/ui/link";
import {
  ClassicButton,
  ClassicConfirm,
  ClassicPageHeader,
  FilterPills,
  RowButton,
  SearchBox,
  StatusPill,
  TableEmpty,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { universityAction, useCourses, useDepartments, useProgrammeCategories } from "@/features/academics/api";
import { ClassicCourseModal, ClassicSchemeModal, FeeAmount } from "@/features/academics/components/classic-course-modals";
import { ordinal, runAction } from "@/features/academics/components/ui";
import type { Course } from "@/features/academics/types";

/**
 * Courses (admin): an exact replica of the old University Portal's Courses
 * page - search, programme pills and one row per course (diploma, semester,
 * fee, theory/practical split, status, credits) with Assessments / Edit / Delete.
 */

// "Culinary Programmes" -> "Culinary".
const shortProgrammeLabel = (label: string) => label.replace(/ Programmes?$/i, "");

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const query = useCourses({ search: debouncedSearch, category: programme });
  const categories = useProgrammeCategories().data?.categories ?? [];
  const departments = useDepartments().data?.departments ?? [];
  const courses = query.data?.courses ?? [];

  const [modal, setModal] = useState<Course | "new" | null>(null);
  const [scheme, setScheme] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    const course = deleting;
    setDeleting(null);
    await runAction(universityAction("delete", `/courses/${course.id}`), `Course ${course.name} deleted.`);
  }

  return (
    <PageContainer className="gap-0">
      <ClassicPageHeader
        title="Courses"
        subtitle={`${courses.length} courses across ${departments.length} departments`}
        action={
          <ClassicButton onClick={() => setModal("new")}>
            <Plus className="size-4" /> Add Course
          </ClassicButton>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by course name or code…" />
      </div>
      <div className="mb-4">
        <FilterPills
          label="Programme"
          value={programme}
          onChange={setProgramme}
          options={[{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.key, label: shortProgrammeLabel(c.label) }))]}
        />
      </div>

      <QueryView query={query} loading={<ListSkeleton rows={7} />}>
        {() => (
          <div className={cn("flex flex-col gap-[0.6rem]", query.isPlaceholderData && "opacity-60 transition-opacity")}>
            {courses.length === 0 ? (
              <TableEmpty>No courses match your filters.</TableEmpty>
            ) : (
              courses.map((c) => {
                const dept = c.department;
                const active = c.status === "ACTIVE";
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-[0.9rem] rounded-md border border-border bg-card px-4 py-[0.85rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-[0_2px_8px_rgba(23,31,50,.07)] max-[720px]:flex-wrap"
                  >
                    {/* .course-row-main: the whole left part opens the course. */}
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="flex min-w-0 flex-1 items-center gap-[0.9rem] max-[720px]:order-1 max-[720px]:basis-full max-[720px]:flex-wrap"
                    >
                      <div
                        className="shrink-0 rounded-md px-[0.55rem] py-[0.3rem] text-[0.72rem] font-bold tracking-[0.03em]"
                        style={{ color: dept?.color, background: dept?.bg }}
                      >
                        {c.code}
                      </div>
                      <div className="min-w-0 flex-1 max-[720px]:basis-full">
                        <p className="text-[0.87rem] font-semibold text-foreground">{c.name}</p>
                        <div className="mt-[0.2rem] flex flex-wrap items-center gap-[0.6rem]">
                          <span
                            className="inline-block max-w-full whitespace-nowrap rounded-xl px-2 py-[0.12rem] text-[0.68rem] font-bold"
                            style={{ color: dept?.color, background: dept?.bg }}
                          >
                            {dept?.name}
                          </span>
                          {dept ? (
                            <span className="whitespace-nowrap text-[0.74rem] text-muted-foreground">{ordinal(dept.semester)} Semester</span>
                          ) : null}
                          <FeeAmount fee={c.totalFee ?? c.fee} discountRate={c.discountRate} />
                          <span className="whitespace-nowrap text-[0.74rem] text-muted-foreground">
                            {c.assessmentScheme?.length
                              ? `Theory ${c.theoryPercent}% · Practical ${100 - c.theoryPercent}%`
                              : "No assessments defined"}
                          </span>
                        </div>
                      </div>
                      <StatusPill tone={active ? "success" : "muted"}>{active ? "Active" : "Inactive"}</StatusPill>
                      <div className="inline-flex shrink-0 items-center gap-[0.3rem] whitespace-nowrap text-xs font-semibold text-mid-foreground">
                        <Clock className="size-[13px]" aria-hidden /> {c.creditHours} CR
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-border-strong" aria-hidden />
                    </Link>
                    {/* .course-actions */}
                    <div className="flex shrink-0 gap-[0.4rem] max-[720px]:order-2 max-[720px]:ml-auto">
                      <RowButton
                        kind="edit"
                        icon={ClipboardList}
                        label="Assessments"
                        title="Theory/practical split and assessments"
                        onClick={() => setScheme(c)}
                      />
                      <RowButton kind="edit" icon={Pencil} label="Edit" title="Edit course" onClick={() => setModal(c)} />
                      <RowButton kind="delete" icon={Trash2} label="Delete" title="Delete course" onClick={() => setDeleting(c)} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </QueryView>

      {modal ? (
        <ClassicCourseModal
          departments={departments}
          categories={categories}
          course={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
        />
      ) : null}
      {scheme ? <ClassicSchemeModal course={scheme} onClose={() => setScheme(null)} /> : null}
      <ClassicConfirm
        open={deleting !== null}
        title="Delete Course"
        message={`Are you sure you want to delete "${deleting?.name}" (${deleting?.code})? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
