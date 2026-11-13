import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Link2, Plus, Scale, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";
import { useParams, useRouter, useSearchParams } from "@/lib/navigation";
import { FormDialog } from "@/features/academics/components/form-dialog";
import {
  FirstOfferingRedirect,
  OfferingPicker,
  PageLoading,
  ViewSwitch,
} from "@/features/academics/components/teaching-picker";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { runAction, TableCard } from "@/features/academics/components/ui";
import { categoryLabel, GRADE_LETTERS, type GradeRange } from "@/features/academics/lib/marks";

interface Assessment {
  id: number;
  title: string;
  totalMarks: number;
  /** The classroom assignment whose returned grades fill this item, if linked. */
  assignment: { id: string; title: string } | null;
}
interface Category {
  id: number;
  type: string;
  weightage: number | null;
  component: "THEORY" | "PRACTICAL" | null;
  fromScheme: boolean;
  singleAssessment: boolean;
  assessments: Assessment[];
}
interface Summary {
  obtained: number;
  total: number;
  percentage: number | null;
  computedPercentage: number | null;
  adjusted: boolean;
  grade: string | null;
  computedGrade: string | null;
  gradeAdjusted: boolean;
}
interface StudentRow {
  enrollmentId: number;
  student: { id: number; name: string; rollNo: string };
  marks: Record<string, number | null>;
  summary: Summary;
  published: { grade: string; visibleFrom: Date } | null;
}
interface Sheet {
  offering: {
    course: { code: string; name: string };
    section: { label: string; batch: string; department: { code: string } };
  };
  categories: Category[];
  students: StudentRow[];
  grading: { grades: GradeRange[]; custom: boolean };
  classwork: { id: string; title: string; points: number; linked: boolean }[];
  weighted: boolean;
  totalWeightage: number;
  hasScheme: boolean;
}

const BASE = "/marks";

const schemeNote = (sheet: Sheet) =>
  sheet.weighted
    ? "Each item counts towards its category's weightage in the course's assessment scheme."
    : sheet.hasScheme
      ? `The scheme covers ${sheet.totalWeightage}% so far; percentages use raw totals until it reaches 100%.`
      : "No assessment scheme yet - an administrator sets it on the course page.";

const categoryMeta = (c: Category) =>
  `${c.weightage ?? 0}%${c.component ? ` · ${c.component === "THEORY" ? "theory" : "practical"}` : ""}`;

/** Adds the next item to a category ("Quiz 3"), optionally filled from classwork. */
function AddItemDialog({ category, sheet, onClose }: { category: Category | null; sheet: Sheet; onClose: () => void }) {
  return (
    <FormDialog
      open={category !== null}
      onOpenChange={(open) => !open && onClose()}
      title={category ? `Add to ${categoryLabel(category.type)}` : ""}
      description="Items are numbered automatically (Quiz 3...); mid, practical and final are single exams."
      fields={[
        { name: "totalMarks", label: "Out of (total marks)", type: "number", required: true, min: 1, max: 1000 },
        {
          name: "assignmentId",
          label: "Fill from classwork",
          type: "select",
          hint: "Returned grades of this assignment are copied in, scaled to the total.",
          placeholder: "None - I'll enter marks myself",
          options: sheet.classwork.filter((a) => !a.linked).map((a) => ({ value: a.id, label: `${a.title} (${a.points} pts)` })),
        },
      ]}
      initialValues={{ totalMarks: 10, assignmentId: "" }}
      submitLabel="Add"
      onSubmit={(values) =>
        universityAction("post", `/marks/categories/${category!.id}/assessments`, {
          totalMarks: values.totalMarks,
          assignmentId: values.assignmentId || null,
        })
      }
    />
  );
}

/** Edit the percentage range of every letter grade for this section. */
function GradingDialog({ path, grading, onClose }: { path: string; grading: Sheet["grading"]; onClose: () => void }) {
  const [rows, setRows] = useState(grading.grades.map((g) => ({ ...g })));
  const set = (index: number, key: "min" | "max", value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: Number(value) } : row)));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grading criteria</DialogTitle>
          <DialogDescription>Each grade's range must start right above the next one, from 0 to 100%.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
          <span />
          <span className="text-xs font-semibold text-muted-foreground">From %</span>
          <span className="text-xs font-semibold text-muted-foreground">To %</span>
          {rows.map((row, i) => (
            <div key={row.grade} className="contents">
              <span className="w-10 font-bold">{row.grade}</span>
              <Input type="number" aria-label={`${row.grade} from`} value={row.min} onChange={(e) => set(i, "min", e.target.value)} />
              <Input type="number" aria-label={`${row.grade} to`} value={row.max} onChange={(e) => set(i, "max", e.target.value)} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (await runAction(universityAction("put", `${path}/grading`, { grades: rows }))) onClose();
            }}
          >
            Save criteria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** By assessment: every student's marks for one item at once; change its total or delete it. */
function AssessmentDialog({ assessment, sheet, onClose }: { assessment: Assessment; sheet: Sheet; onClose: () => void }) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [total, setTotal] = useState(String(assessment.totalMarks));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setValues(
      Object.fromEntries(
        sheet.students.map((s) => [s.enrollmentId, s.marks[assessment.id] === null ? "" : String(s.marks[assessment.id])]),
      ),
    );
  }, [assessment.id, sheet.students]);

  async function save() {
    setSaving(true);
    if (Number(total) !== assessment.totalMarks) {
      const ok = await runAction(universityAction("put", `/marks/assessments/${assessment.id}`, { totalMarks: Number(total) }));
      if (!ok) {
        setSaving(false);
        return;
      }
    }
    // Only the boxes the teacher changed: a new total re-scales linked classwork marks on the server,
    // and re-sending the old values would undo that.
    const before = new Map(sheet.students.map((s) => [s.enrollmentId, s.marks[assessment.id] ?? null]));
    const records = Object.entries(values)
      .map(([enrollmentId, value]) => ({ enrollmentId: Number(enrollmentId), obtained: value === "" ? null : Number(value) }))
      .filter((r) => r.obtained !== before.get(r.enrollmentId));
    const ok =
      records.length === 0 || (await runAction(universityAction("put", `/marks/assessments/${assessment.id}/marks`, { records })));
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{assessment.title}</DialogTitle>
            <DialogDescription>
              {assessment.assignment
                ? `Filled from "${assessment.assignment.title}": each grade is copied here when the work is returned, scaled to this total.`
                : "Leave a box empty for a student who hasn't been marked yet."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="total-marks">Out of</Label>
            <Input id="total-marks" type="number" min={1} className="w-28" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <div className="flex flex-col divide-y divide-border">
            {sheet.students.map((s) => (
              <label key={s.enrollmentId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex flex-col">
                  <span className="font-semibold">{s.student.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{s.student.rollNo}</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  max={Number(total)}
                  step={0.5}
                  className="w-24"
                  aria-label={`Marks for ${s.student.name}`}
                  value={values[s.enrollmentId] ?? ""}
                  onChange={(e) => setValues((current) => ({ ...current, [s.enrollmentId]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setDeleting(true)}>
              <Trash2 /> Delete
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save marks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${assessment.title}?`}
        description="Its marks are deleted for every student."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await runAction(universityAction("delete", `/marks/assessments/${assessment.id}`));
          setDeleting(false);
          onClose();
        }}
      />
    </>
  );
}

function GradeCell({ summary, published }: Pick<StudentRow, "summary" | "published">) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold">{summary.grade ?? "-"}</span>
      {summary.gradeAdjusted ? <Badge variant="warning">Changed</Badge> : null}
      {published ? <Badge variant="info">Released {published.grade}</Badge> : null}
    </div>
  );
}

/** Students view: one row per registered student; each opens their marksheet. */
function StudentsView({ sheet, path }: { sheet: Sheet; path: string }) {
  const router = useRouter();
  if (sheet.students.length === 0) {
    return <EmptyState icon={ClipboardList} title="No students registered yet" description="Students appear here once they register for this course." />;
  }
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead className="text-right">Marked</TableHead>
            <TableHead className="text-right">Percentage</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sheet.students.map((s) => {
            const items = Object.values(s.marks);
            const href = `${BASE}/${path}/${s.enrollmentId}`;
            return (
              <TableRow key={s.enrollmentId} className="cursor-pointer" onClick={() => router.push(href)}>
                <TableCell>
                  <Link href={href} className="flex flex-col hover:underline" onClick={(e) => e.stopPropagation()}>
                    <span className="font-semibold">{s.student.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.student.rollNo}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {items.filter((m) => m !== null).length}/{items.length}
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.summary.percentage === null ? "-" : `${s.summary.percentage}%`}</TableCell>
                <TableCell>
                  <GradeCell summary={s.summary} published={s.published} />
                </TableCell>
                <TableCell>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableCard>
  );
}

/** By assessment view: the categories with their items, and every student's marks in one grid. */
function AssessmentsView({ sheet }: { sheet: Sheet }) {
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [adding, setAdding] = useState<Category | null>(null);
  const assessments = sheet.categories.flatMap((c) => c.assessments);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sheet.categories.map((category) => (
          <Card key={category.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-semibold">{categoryLabel(category.type)}</span>
                <span className="text-xs text-muted-foreground">{categoryMeta(category)}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Add to ${categoryLabel(category.type)}`}
                disabled={category.singleAssessment && category.assessments.length > 0}
                onClick={() => setAdding(category)}
              >
                <Plus />
              </Button>
            </div>
            {category.assessments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {category.assessments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setEditing(a)}
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:border-gold hover:bg-accent"
                    title={a.assignment ? `From classwork: ${a.assignment.title}` : undefined}
                  >
                    {a.title} <span className="font-normal text-muted-foreground">/{a.totalMarks}</span>
                    {a.assignment ? <Link2 className="ml-1 inline size-3 text-muted-foreground" aria-label="Linked to classwork" /> : null}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      {sheet.students.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No students registered yet" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                {assessments.map((a) => (
                  <TableHead key={a.id} className="text-right">
                    <button onClick={() => setEditing(a)} className="hover:underline">
                      {a.title}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="text-right">%</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.students.map((s) => (
                <TableRow key={s.enrollmentId}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-semibold">{s.student.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{s.student.rollNo}</span>
                    </span>
                  </TableCell>
                  {assessments.map((a) => (
                    <TableCell key={a.id} className="text-right tabular-nums">
                      {s.marks[a.id] ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">{s.summary.percentage ?? "-"}</TableCell>
                  <TableCell>
                    <GradeCell summary={s.summary} published={s.published} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing ? <AssessmentDialog assessment={editing} sheet={sheet} onClose={() => setEditing(null)} /> : null}
      <AddItemDialog category={adding} sheet={sheet} onClose={() => setAdding(null)} />
    </div>
  );
}

/** One student's marksheet: every category of the scheme with its items, and a marks box for each. */
function Marksheet({ sheet, row, path, isAdmin }: { sheet: Sheet; row: StudentRow; path: string; isAdmin: boolean }) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<Category | null>(null);
  const index = sheet.students.findIndex((s) => s.enrollmentId === row.enrollmentId);
  const previous = sheet.students[index - 1];
  const next = sheet.students[index + 1];

  useEffect(() => {
    setValues(Object.fromEntries(Object.entries(row.marks).map(([id, value]) => [id, value === null ? "" : String(value)])));
  }, [row.marks]);

  const changed = Object.entries(values)
    .map(([id, value]) => ({ assessmentId: Number(id), obtained: value === "" ? null : Number(value) }))
    .filter((r) => r.obtained !== (row.marks[r.assessmentId] ?? null));

  async function save() {
    setSaving(true);
    await runAction(universityAction("put", `/marks/enrollments/${row.enrollmentId}/marks`, { records: changed }));
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`${BASE}/${path}`}>
            <ChevronLeft /> All students
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!previous} asChild={Boolean(previous)}>
            {previous ? <Link href={`${BASE}/${path}/${previous.enrollmentId}`}>Previous</Link> : <span>Previous</span>}
          </Button>
          <Button variant="outline" size="sm" disabled={!next} asChild={Boolean(next)}>
            {next ? <Link href={`${BASE}/${path}/${next.enrollmentId}`}>Next</Link> : <span>Next</span>}
          </Button>
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-x-8 gap-y-4 p-5">
        <div className="flex flex-col">
          <span className="text-lg font-bold">{row.student.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.student.rollNo}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Percentage</span>
          {isAdmin ? (
            <Input
              key={`${row.enrollmentId}-${row.summary.percentage}`}
              type="number"
              aria-label="Course percentage"
              className="h-9 w-24"
              defaultValue={row.summary.percentage ?? ""}
              title={row.summary.adjusted ? `Adjusted (calculated ${row.summary.computedPercentage ?? "-"}%)` : "Calculated from marks"}
              onBlur={async (e) => {
                const value = e.target.value === "" ? null : Number(e.target.value);
                if (value !== row.summary.percentage) {
                  await runAction(universityAction("put", `/marks/enrollments/${row.enrollmentId}/percentage`, { percentage: value }));
                }
              }}
            />
          ) : (
            <span className="text-2xl font-bold tabular-nums">{row.summary.percentage === null ? "-" : `${row.summary.percentage}%`}</span>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grade</span>
          <Select
            className="h-9 w-28"
            aria-label="Grade"
            value={row.summary.gradeAdjusted ? (row.summary.grade ?? "") : ""}
            onChange={(e) =>
              runAction(universityAction("put", `/marks/enrollments/${row.enrollmentId}/grade`, { grade: e.target.value || null }))
            }
          >
            <option value="">{row.summary.computedGrade ? `${row.summary.computedGrade} (calculated)` : "-"}</option>
            {GRADE_LETTERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </label>
        {row.published ? <Badge variant="info">Released {row.published.grade}</Badge> : null}
      </Card>

      {sheet.categories.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assessment scheme yet" description="An administrator sets the course's assessments on the course page." />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead className="text-right">Out of</TableHead>
                <TableHead className="text-right">Marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.categories.map((category) => (
                <CategoryRows
                  key={category.id}
                  category={category}
                  values={values}
                  onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
                  onAdd={() => setAdding(category)}
                />
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || changed.length === 0}>
          {saving ? "Saving…" : "Save marksheet"}
        </Button>
      </div>
      <AddItemDialog category={adding} sheet={sheet} onClose={() => setAdding(null)} />
    </div>
  );
}

function CategoryRows({
  category,
  values,
  onChange,
  onAdd,
}: {
  category: Category;
  values: Record<number, string>;
  onChange: (assessmentId: number, value: string) => void;
  onAdd: () => void;
}) {
  const canAdd = !(category.singleAssessment && category.assessments.length > 0);
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={3}>
          <div className="flex items-center justify-between gap-2">
            <span>
              <span className="font-bold">{categoryLabel(category.type)}</span>{" "}
              <span className="text-xs text-muted-foreground">· {categoryMeta(category)}</span>
            </span>
            {canAdd ? (
              <Button size="sm" variant="ghost" onClick={onAdd} aria-label={`Add to ${categoryLabel(category.type)}`}>
                <Plus /> Add
              </Button>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
      {category.assessments.length === 0 ? (
        <TableRow>
          <TableCell colSpan={3} className="pl-6 text-sm text-muted-foreground">
            No items yet.
          </TableCell>
        </TableRow>
      ) : (
        category.assessments.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="pl-6">
              {a.title}
              {a.assignment ? (
                <span className="ml-1.5 text-xs text-muted-foreground" title={`Filled when "${a.assignment.title}" is returned`}>
                  <Link2 className="inline size-3" aria-label="Linked to classwork" /> {a.assignment.title}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">{a.totalMarks}</TableCell>
            <TableCell className="text-right">
              <Input
                type="number"
                min={0}
                max={a.totalMarks}
                step={0.5}
                className="ml-auto h-8 w-24 text-right"
                aria-label={`Marks for ${a.title}`}
                value={values[a.id] ?? ""}
                onChange={(e) => onChange(a.id, e.target.value)}
              />
            </TableCell>
          </TableRow>
        ))
      )}
    </>
  );
}

/** /marks/:sectionId/:courseId[/:enrollmentId] - marks for one course section the viewer teaches. */
function OfferingMarks({ sectionId, courseId, enrollmentId }: { sectionId: number; courseId: number; enrollmentId: number | null }) {
  const path = `${sectionId}/${courseId}`;
  const query = useUniversityQuery<Sheet>(`/marks/${path}`);
  const isAdmin = useSession().data?.user.role === "ADMIN";
  const byAssessment = useSearchParams().get("view") === "assessment";
  const [grading, setGrading] = useState(false);

  return (
    <QueryView query={query} loading={<PageLoading />}>
      {(sheet) => {
        const row = enrollmentId === null ? null : (sheet.students.find((s) => s.enrollmentId === enrollmentId) ?? null);
        const { course, section } = sheet.offering;
        return (
          <PageContainer>
            <SectionHeader
              title="Marks"
              description={`${course.code} ${course.name} · ${section.department.code} ${section.batch}-${section.label}. ${schemeNote(sheet)}`}
              breadcrumbs={[
                { label: "Marks", href: `${BASE}/${path}` },
                ...(row ? [{ label: row.student.name }] : []),
              ]}
              actions={
                <Button variant="outline" onClick={() => setGrading(true)}>
                  <Scale /> Grading criteria{sheet.grading.custom ? " (custom)" : ""}
                </Button>
              }
            />
            <OfferingPicker base={BASE} sectionId={sectionId} courseId={courseId} />
            {enrollmentId !== null ? (
              row ? (
                <Marksheet sheet={sheet} row={row} path={path} isAdmin={isAdmin} />
              ) : (
                <EmptyState icon={ClipboardList} title="Student not found" description="They aren't registered in this course section." />
              )
            ) : (
              <>
                <ViewSwitch
                  options={[
                    { label: "Students", href: `${BASE}/${path}`, active: !byAssessment },
                    { label: "By assessment", href: `${BASE}/${path}?view=assessment`, active: byAssessment },
                  ]}
                />
                {byAssessment ? <AssessmentsView sheet={sheet} /> : <StudentsView sheet={sheet} path={path} />}
              </>
            )}
            {grading ? <GradingDialog path={`/marks/${path}`} grading={sheet.grading} onClose={() => setGrading(false)} /> : null}
          </PageContainer>
        );
      }}
    </QueryView>
  );
}

/** Marks (teachers and admins), from the sidebar. */
export default function MarksPage() {
  const params = useParams<{ sectionId?: string; courseId?: string; enrollmentId?: string }>();
  if (!params.sectionId || !params.courseId) {
    return (
      <FirstOfferingRedirect
        base={BASE}
        title="Marks"
        description="Enter marks for the course sections you teach."
      />
    );
  }
  return (
    <OfferingMarks
      key={`${params.sectionId}/${params.courseId}`}
      sectionId={Number(params.sectionId)}
      courseId={Number(params.courseId)}
      enrollmentId={params.enrollmentId ? Number(params.enrollmentId) : null}
    />
  );
}
