import { useEffect, useState } from "react";
import { ClipboardList, Plus, Scale, Trash2 } from "lucide-react";

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
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClassroomTabLoading, useCurrentClassroom } from "@/pages/classes/classroom-layout";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";
import { FormDialog } from "@/features/academics/components/form-dialog";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { runAction, TableCard } from "@/features/academics/components/ui";
import { categoryLabel, GRADE_LETTERS, type GradeRange } from "@/features/academics/lib/marks";

interface Assessment {
  id: number;
  title: string;
  totalMarks: number;
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
interface Sheet {
  categories: {
    id: number;
    type: string;
    weightage: number | null;
    component: "THEORY" | "PRACTICAL" | null;
    fromScheme: boolean;
    singleAssessment: boolean;
    assessments: Assessment[];
  }[];
  students: {
    enrollmentId: number;
    student: { id: number; name: string; rollNo: string };
    marks: Record<string, number | null>;
    summary: Summary;
    published: { grade: string; visibleFrom: Date } | null;
  }[];
  grading: { grades: GradeRange[]; custom: boolean };
  weighted: boolean;
  totalWeightage: number;
  hasScheme: boolean;
}

/** Enter (or clear) every student's marks for one assessment; change its total or delete it. */
function MarksDialog({
  assessment,
  sheet,
  onClose,
}: {
  assessment: Assessment;
  sheet: Sheet;
  onClose: () => void;
}) {
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
    const ok = await runAction(
      universityAction("put", `/marks/assessments/${assessment.id}/marks`, {
        records: Object.entries(values).map(([enrollmentId, value]) => ({
          enrollmentId: Number(enrollmentId),
          obtained: value === "" ? null : Number(value),
        })),
      }),
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{assessment.title}</DialogTitle>
            <DialogDescription>Leave a box empty for a student who hasn't been marked yet.</DialogDescription>
          </DialogHeader>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total-marks">Out of</Label>
              <Input id="total-marks" type="number" min={1} className="w-28" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
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

function TeacherMarks({ sectionId, courseId, isAdmin }: { sectionId: number; courseId: number; isAdmin: boolean }) {
  const path = `/marks/${sectionId}/${courseId}`;
  const query = useUniversityQuery<Sheet>(path);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [grading, setGrading] = useState(false);
  const [adding, setAdding] = useState<Sheet["categories"][number] | null>(null);

  return (
    <QueryView query={query} loading={<ClassroomTabLoading />}>
      {(sheet) => {
        const assessments = sheet.categories.flatMap((c) => c.assessments);
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {sheet.weighted
                  ? "Percentages are weighted by the course's assessment scheme."
                  : sheet.hasScheme
                    ? `The scheme covers ${sheet.totalWeightage}% so far; percentages use raw totals until it reaches 100%.`
                    : "No assessment scheme yet - an administrator sets it on the course page."}
              </p>
              <Button variant="outline" onClick={() => setGrading(true)}>
                <Scale /> Grading criteria{sheet.grading.custom ? " (custom)" : ""}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {sheet.categories.map((category) => (
                <Card key={category.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold">{categoryLabel(category.type)}</span>
                      <span className="text-xs text-muted-foreground">
                        {category.weightage ?? 0}%{category.component ? ` · ${category.component === "THEORY" ? "theory" : "practical"}` : ""}
                      </span>
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
                        >
                          {a.title} <span className="font-normal text-muted-foreground">/{a.totalMarks}</span>
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
                        <TableCell className="text-right tabular-nums">
                          {isAdmin ? (
                            <Input
                              type="number"
                              aria-label={`Percentage for ${s.student.name}`}
                              className="ml-auto h-8 w-20 text-right"
                              defaultValue={s.summary.percentage ?? ""}
                              title={s.summary.adjusted ? `Adjusted (calculated ${s.summary.computedPercentage ?? "-"}%)` : "Calculated from marks"}
                              onBlur={async (e) => {
                                const value = e.target.value === "" ? null : Number(e.target.value);
                                if (value !== s.summary.percentage) {
                                  await runAction(universityAction("put", `/marks/enrollments/${s.enrollmentId}/percentage`, { percentage: value }));
                                }
                              }}
                            />
                          ) : (
                            <>{s.summary.percentage ?? "-"}</>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              className="h-8 w-20"
                              aria-label={`Grade for ${s.student.name}`}
                              value={s.summary.gradeAdjusted ? (s.summary.grade ?? "") : ""}
                              onChange={(e) =>
                                runAction(
                                  universityAction("put", `/marks/enrollments/${s.enrollmentId}/grade`, { grade: e.target.value || null }),
                                )
                              }
                            >
                              <option value="">{s.summary.computedGrade ?? "-"}</option>
                              {GRADE_LETTERS.map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </Select>
                            {s.published ? <Badge variant="info">Released {s.published.grade}</Badge> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
            {editing ? <MarksDialog assessment={editing} sheet={sheet} onClose={() => setEditing(null)} /> : null}
            {grading ? <GradingDialog path={path} grading={sheet.grading} onClose={() => setGrading(false)} /> : null}
            <FormDialog
              open={adding !== null}
              onOpenChange={(open) => !open && setAdding(null)}
              title={adding ? `Add to ${categoryLabel(adding.type)}` : ""}
              description="Items are numbered automatically (Quiz 3...); mid, practical and final are single exams."
              fields={[{ name: "totalMarks", label: "Out of (total marks)", type: "number", required: true, min: 1, max: 1000 }]}
              initialValues={{ totalMarks: 10 }}
              submitLabel="Add"
              onSubmit={(values) => universityAction("post", `/marks/categories/${adding!.id}/assessments`, values)}
            />
          </div>
        );
      }}
    </QueryView>
  );
}

interface MyMarks {
  groups: {
    courses: {
      enrollmentId: number;
      id: number;
      section: { id: number };
      summary: { percentage: number | null; obtained: number; total: number; grade: string | null };
      marks: { id: number; type: string; title: string; obtained: number | null; total: number; weightage: number | null }[];
    }[];
  }[];
}

function StudentMarks({ sectionId, courseId }: { sectionId: number; courseId: number }) {
  const query = useUniversityQuery<MyMarks>("/my/marks");
  return (
    <QueryView query={query} loading={<ClassroomTabLoading />}>
      {({ groups }) => {
        const course = groups.flatMap((g) => g.courses).find((c) => c.id === courseId && c.section.id === sectionId);
        if (!course || course.marks.length === 0) {
          return <EmptyState icon={ClipboardList} title="No marks yet" description="Marks appear here as your teacher grades your work." />;
        }
        return (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-wrap gap-8 p-5">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Percentage so far</span>
                <span className="text-2xl font-bold tabular-nums">{course.summary.percentage ?? "-"}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grade</span>
                <span className="text-2xl font-bold">{course.summary.grade ?? "Not released"}</span>
              </div>
            </Card>
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-right">Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {course.marks.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold">{m.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {categoryLabel(m.type)}
                        {m.weightage ? ` · ${m.weightage}%` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.obtained === null ? <span className="text-muted-foreground">Not marked</span> : `${m.obtained} / ${m.total}`}
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

/** /classes/:id/marks - only for the classroom of a course offering. */
export default function ClassroomMarksPage() {
  const classroom = useCurrentClassroom();
  const isAdmin = useSession().data?.user.role === "ADMIN";
  if (!classroom.offering) {
    return <EmptyState icon={ClipboardList} title="Marks are kept for university courses only" />;
  }
  const { sectionId, courseId } = classroom.offering;
  return classroom.role === "STUDENT" ? (
    <StudentMarks sectionId={sectionId} courseId={courseId} />
  ) : (
    <TeacherMarks sectionId={sectionId} courseId={courseId} isAdmin={isAdmin} />
  );
}
