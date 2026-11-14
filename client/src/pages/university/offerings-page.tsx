import { useState, type FormEvent } from "react";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Alert,
  BlockHeading,
  CardGrid,
  ClassicButton,
  ClassicModal,
  ClassicPageHeader,
  FieldError,
  FieldHint,
  FilterPills,
  FilterPillsRow,
  FormGroup,
  FormLabel,
  inputErrorClass,
  ModalActions,
  StatusPill,
  TableEmpty,
  useViewMode,
  ViewToggle,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { universityAction, useBatches, useDepartments, useProgrammeCategories, useUniversityQuery } from "@/features/academics/api";
import { ordinal, runAction, TableCard } from "@/features/academics/components/ui";

/**
 * Offer Courses (admin): an exact replica of the old University Portal's
 * page - every diploma/batch with courses on offer, grouped by programme,
 * and "Offer Courses" to offer any course of a programme to any of its
 * diplomas' batches (e.g. a course from another diploma students need).
 */

interface OfferingOverview {
  term: { semester: string; year: number };
  departments: {
    id: number;
    name: string;
    code: string;
    category: string;
    semester: number;
    color: string;
    bg: string;
    currentBatches: string[];
    batches: { batch: string; sections: number; offeredCourses: number }[];
  }[];
}

const shortProgrammeLabel = (label: string) => label.replace(/ Programmes?$/i, "");

/** Offer one course (from any diploma of the programme) to every section of a diploma's batch. */
function OfferCourseModal({ onClose }: { onClose: () => void }) {
  const departments = useDepartments().data?.departments ?? [];
  const categories = useProgrammeCategories().data?.categories ?? [];
  const allBatches = useBatches().data?.batches ?? [];
  const [programme, setProgramme] = useState(departments[0]?.category ?? categories[0]?.key ?? "");
  const [departmentId, setDepartmentId] = useState(departments[0] ? String(departments[0].id) : "");
  const [courseId, setCourseId] = useState("");
  const [batch, setBatch] = useState("");
  const [errors, setErrors] = useState<{ departmentId?: string; courseId?: string; batch?: string }>({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState("");

  const diplomas = departments.filter((d) => d.category === programme);
  const department = departments.find((d) => String(d.id) === departmentId) ?? null;
  // Any batch can be picked: one with no sections yet gets Sections A and B on offer.
  const batches = [...new Set([...(department?.sections ?? []).map((s) => s.batch), ...allBatches])];
  // Any course of the programme can be offered to the diploma, except ones the batch already has.
  const offeredIds = new Set(
    (department?.sections ?? []).filter((s) => s.batch === batch).flatMap((s) => s.courseLinks.map((l) => l.courseId)),
  );
  const courses = diplomas.flatMap((d) => d.courses.map((c) => ({ ...c, diploma: d }))).filter((c) => !offeredIds.has(c.id));

  const changeDepartment = (value: string) => {
    setDepartmentId(value);
    setCourseId("");
    setBatch("");
    setErrors({});
    setApiErr("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!departmentId) errs.departmentId = "Diploma is required";
    if (!courseId) errs.courseId = "Course is required";
    if (!batch) errs.batch = "Batch is required";
    if (Object.keys(errs).length) return setErrors(errs);
    setSaving(true);
    setApiErr("");
    const result = await universityAction<{ message?: string }>("post", "/offerings", {
      departmentId: Number(departmentId),
      courseId: Number(courseId),
      batch,
    });
    setSaving(false);
    if (result.status !== "success") return setApiErr(result.message || "Failed to offer course.");
    toast.success(result.data?.message ?? "Course offered.");
    onClose();
  }

  return (
    <ClassicModal open onClose={onClose} title="Offer Course">
      {apiErr ? <Alert>{apiErr}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <FormGroup>
          <FormLabel htmlFor="offer-programme" required>
            Programme
          </FormLabel>
          <Select
            id="offer-programme"
            value={programme}
            onChange={(e) => {
              setProgramme(e.target.value);
              const first = departments.find((d) => d.category === e.target.value);
              changeDepartment(first ? String(first.id) : "");
            }}
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="offer-diploma" required>
            Diploma
          </FormLabel>
          {diplomas.length === 0 ? (
            <FieldHint>This programme has no diplomas yet.</FieldHint>
          ) : (
            <Select
              id="offer-diploma"
              value={departmentId}
              onChange={(e) => changeDepartment(e.target.value)}
              className={cn(errors.departmentId && inputErrorClass)}
            >
              {diplomas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>
          )}
          <FieldError>{errors.departmentId}</FieldError>
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="offer-batch" required>
            Batch
          </FormLabel>
          <Select
            id="offer-batch"
            value={batch}
            onChange={(e) => {
              setBatch(e.target.value);
              setCourseId("");
              setErrors((p) => ({ ...p, batch: "" }));
            }}
            className={cn(errors.batch && inputErrorClass)}
          >
            <option value="">Select a batch…</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          {batch && !(department?.sections ?? []).some((s) => s.batch === batch) ? (
            <FieldHint>Batch {batch} has no sections yet — Sections A and B will be created.</FieldHint>
          ) : null}
          <FieldError>{errors.batch}</FieldError>
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="offer-course" required>
            Course Code
          </FormLabel>
          {!batch ? (
            <FieldHint>Select a batch to see the courses it can be offered.</FieldHint>
          ) : courses.length === 0 ? (
            <FieldHint>Every course in this programme is already offered to Batch {batch} of this diploma.</FieldHint>
          ) : (
            <Select
              id="offer-course"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setErrors((p) => ({ ...p, courseId: "" }));
              }}
              className={cn(errors.courseId && inputErrorClass)}
            >
              <option value="">Select a course…</option>
              {diplomas.map((d) => {
                const group = courses.filter((c) => c.diploma.id === d.id);
                return group.length > 0 ? (
                  <optgroup key={d.id} label={`${d.name} (${d.code}) · ${ordinal(d.semester)} Semester`}>
                    {group.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </Select>
          )}
          <FieldError>{errors.courseId}</FieldError>
        </FormGroup>

        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={saving || (Boolean(batch) && courses.length === 0)}>
            {saving ? "Offering…" : "Offer Course"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}

const currentPill = (semester: number) => <StatusPill tone="success">Current · {ordinal(semester)} Semester</StatusPill>;

export default function OfferingsPage() {
  const router = useRouter();
  const query = useUniversityQuery<OfferingOverview>("/offerings", { keepPrevious: true });
  const categories = useProgrammeCategories().data?.categories ?? [];
  const allBatches = useBatches().data?.batches ?? [];
  const [programme, setProgramme] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [view, setView] = useViewMode();
  const [offering, setOffering] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);

  return (
    <PageContainer className="gap-0">
      <ClassicPageHeader
        title="Offer Courses"
        subtitle="Opening registration offers each batch every course of its current diploma. Offer it courses from any other diploma of its programme here."
        action={
          <div className="flex flex-wrap gap-2">
            <ClassicButton
              variant="outline"
              disabled={catchingUp}
              title="Offer each batch any course of its current diploma it doesn't have yet"
              onClick={async () => {
                setCatchingUp(true);
                await runAction(universityAction("post", "/offerings/current"));
                setCatchingUp(false);
              }}
            >
              <Sparkles className="size-4" /> {catchingUp ? "Offering…" : "Offer this term's diplomas"}
            </ClassicButton>
            <ClassicButton onClick={() => setOffering(true)}>
              <Plus className="size-4" /> Offer Courses
            </ClassicButton>
          </div>
        }
      />

      <QueryView query={query} loading={<ListSkeleton rows={6} />}>
        {({ departments }) => {
          // One row per diploma + batch with courses on offer: current diplomas first, newest batch, then semester.
          const rows = departments
            .flatMap((d) =>
              d.batches.map((b) => ({
                department: d,
                batch: b.batch,
                sectionCount: b.sections,
                offeredCount: b.offeredCourses,
                current: d.currentBatches.includes(b.batch),
              })),
            )
            .filter((r) => r.offeredCount > 0)
            .sort(
              (a, b) =>
                Number(b.current) - Number(a.current) ||
                b.batch.localeCompare(a.batch, undefined, { numeric: true }) ||
                a.department.semester - b.department.semester,
            );
          const batches = [...new Set([...rows.map((r) => r.batch), ...allBatches])];
          const programmeRows = programme ? rows.filter((r) => r.department.category === programme) : rows;
          const visibleRows = batchFilter ? programmeRows.filter((r) => r.batch === batchFilter) : programmeRows;
          const groups = categories
            .map((c) => ({ category: c, rows: visibleRows.filter((r) => r.department.category === c.key) }))
            .filter((g) => g.rows.length > 0);
          const open = (r: (typeof rows)[number]) => router.push(`/admin/offerings/${r.department.id}/${encodeURIComponent(r.batch)}`);

          return (
            <>
              <div className="mb-4">
                <FilterPillsRow>
                  <FilterPills
                    label="Programme"
                    value={programme}
                    onChange={setProgramme}
                    options={[
                      { value: "", label: "All", count: rows.length },
                      ...categories.map((c) => ({
                        value: c.key,
                        label: shortProgrammeLabel(c.label),
                        count: rows.filter((r) => r.department.category === c.key).length,
                      })),
                    ]}
                  />
                  <FilterPills
                    label="Batch"
                    value={batchFilter}
                    onChange={setBatchFilter}
                    options={[
                      { value: "", label: "All", count: programmeRows.length },
                      ...batches.map((b) => ({ value: b, label: b, count: programmeRows.filter((r) => r.batch === b).length })),
                    ]}
                  />
                </FilterPillsRow>
              </div>
              <div className="mb-5">
                <ViewToggle view={view} onChange={setView} />
              </div>

              {groups.length === 0 ? (
                <TableEmpty>
                  {batchFilter ? `No courses are offered to Batch ${batchFilter} yet.` : "No courses offered yet."} Offer a course to a
                  batch to see it here.
                </TableEmpty>
              ) : (
                groups.map(({ category, rows: groupRows }) => (
                  <div key={category.key} className="mb-6">
                    <BlockHeading className="mb-[0.9rem]">{category.label}</BlockHeading>
                    {view === "list" ? (
                      <TableCard>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Batch</TableHead>
                              <TableHead>Diploma</TableHead>
                              <TableHead>Sections</TableHead>
                              <TableHead>Courses Offered</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupRows.map((r) => (
                              <TableRow key={`${r.department.id}-${r.batch}`} className="cursor-pointer [&>td]:whitespace-normal" onClick={() => open(r)}>
                                <TableCell className="font-semibold">Batch {r.batch}</TableCell>
                                <TableCell>
                                  <div>{r.department.name}</div>
                                  <div className="whitespace-nowrap text-[0.8rem] text-muted-foreground">{r.department.code}</div>
                                </TableCell>
                                <TableCell>{r.sectionCount}</TableCell>
                                <TableCell>{r.offeredCount}</TableCell>
                                <TableCell>{r.current ? currentPill(r.department.semester) : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableCard>
                    ) : (
                      <CardGrid>
                        {groupRows.map((r) => (
                          <div
                            key={`${r.department.id}-${r.batch}`}
                            role="link"
                            tabIndex={0}
                            onClick={() => open(r)}
                            onKeyDown={(e) => e.key === "Enter" && open(r)}
                            className="cursor-pointer rounded-[10px] border border-border bg-card p-[1.1rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-[0_2px_8px_rgba(23,31,50,.07)]"
                          >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-[0.6rem]">
                              <span className="text-[0.8rem] font-bold text-foreground">
                                Batch {r.batch} · {r.department.code}
                              </span>
                              {r.current ? currentPill(r.department.semester) : null}
                            </div>
                            <p className="text-[0.87rem] font-semibold text-foreground">{r.department.name}</p>
                            <p className="text-[0.82rem] text-muted-foreground">
                              {r.sectionCount} section{r.sectionCount !== 1 ? "s" : ""} · {r.offeredCount} course
                              {r.offeredCount !== 1 ? "s" : ""} offered
                            </p>
                          </div>
                        ))}
                      </CardGrid>
                    )}
                  </div>
                ))
              )}
            </>
          );
        }}
      </QueryView>

      {offering ? <OfferCourseModal onClose={() => setOffering(false)} /> : null}
    </PageContainer>
  );
}
