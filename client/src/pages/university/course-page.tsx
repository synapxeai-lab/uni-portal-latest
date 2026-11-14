import { useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BackLink, BlockHeading, ClassicConfirm, NavLink, RowButton, StatusPill } from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { universityAction, useCourse } from "@/features/academics/api";
import {
  ClassicExtraFeeModal,
  ClassicSchemeModal,
  COMPONENT_LABELS,
  COMPONENT_PILL,
  markTypeLabel,
  sortScheme,
} from "@/features/academics/components/classic-course-modals";
import { ordinal, runAction, TableCard } from "@/features/academics/components/ui";
import type { CourseDetail, ExtraFee } from "@/features/academics/types";
import { cn } from "@/lib/utils";

/**
 * One course (admin): an exact replica of the old University Portal's course
 * page - header card, fees, who teaches it per section, and its assessment
 * scheme with theory/practical totals.
 */

const formatPKR = (n: number) => `Rs. ${(Number(n) || 0).toLocaleString("en-PK")}`;
const applyDiscount = (amount: number, rate: number) => Math.round(amount * (1 - (rate || 0) / 100));
const fmtPct = (n: number) => `${Math.round(n * 100) / 100}%`;
const muted = "whitespace-nowrap text-[0.8rem] text-muted-foreground";

/** .view-toggle-row: a block heading with its action on the right. */
function HeadingRow({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-[0.9rem] flex flex-wrap items-center justify-between gap-3 [&>h3]:mb-0">
      {children}
      {action}
    </div>
  );
}

/** Course fee plus the extra named fees; their sum is what students are charged. */
function CourseFees({ course }: { course: CourseDetail }) {
  const [modal, setModal] = useState<{ fee?: ExtraFee } | null>(null);
  const [removing, setRemoving] = useState<ExtraFee | null>(null);
  const total = course.totalFee ?? course.fee + course.extraFees.reduce((s, f) => s + f.amount, 0);

  async function remove() {
    if (!removing) return;
    const fee = removing;
    setRemoving(null);
    await runAction(universityAction("delete", `/courses/${course.id}/fees/${fee.id}`));
  }

  return (
    <>
      <HeadingRow
        action={<RowButton kind="edit" icon={Plus} label="Add Fee" title="Add a fee to this course" onClick={() => setModal({})} />}
      >
        <BlockHeading>Fees · Total {formatPKR(total)}</BlockHeading>
      </HeadingRow>
      <TableCard className="mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fee</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="whitespace-normal font-semibold">
                Course Fee
                <div className={cn(muted, "font-normal")}>Set when editing the course on the Courses page</div>
              </TableCell>
              <TableCell>{formatPKR(course.fee)}</TableCell>
              <TableCell />
            </TableRow>
            {course.extraFees.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-normal font-semibold">{f.name}</TableCell>
                <TableCell>{formatPKR(f.amount)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-[0.4rem]">
                    <RowButton kind="edit" icon={Pencil} label="Edit" title={`Edit ${f.name}`} onClick={() => setModal({ fee: f })} />
                    <RowButton kind="delete" icon={Trash2} label="Remove" title={`Remove ${f.name}`} onClick={() => setRemoving(f)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">
                <strong>Total</strong>
              </TableCell>
              <TableCell>
                <strong>{formatPKR(total)}</strong>
                {course.discountRate > 0 ? (
                  <div className={muted}>
                    {formatPKR(applyDiscount(total, course.discountRate))} after {course.discountRate}% discount
                  </div>
                ) : null}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>
      {modal ? <ClassicExtraFeeModal course={course} fee={modal.fee} onClose={() => setModal(null)} /> : null}
      <ClassicConfirm
        open={removing !== null}
        title="Remove Fee"
        message={removing ? `Remove ${removing.name} (${formatPKR(removing.amount)}) from this course?` : ""}
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}

function CourseBody({ course }: { course: CourseDetail }) {
  const [editingScheme, setEditingScheme] = useState(false);
  const department = course.department;
  const scheme = course.assessmentScheme ?? [];
  // Assigned vs available weightage per part; a scheme can be saved before it reaches 100%.
  const schemeTotals = [
    { component: "THEORY", share: course.theoryPercent },
    { component: "PRACTICAL", share: 100 - course.theoryPercent },
  ]
    .filter((t) => t.share > 0)
    .map((t) => {
      const assigned = scheme.filter((e) => e.component === t.component).reduce((s, e) => s + e.weightage, 0);
      return { ...t, assigned, remaining: t.share - assigned };
    });
  const totalRemaining = schemeTotals.reduce((s, t) => s + Math.max(0, t.remaining), 0);
  const active = course.status === "ACTIVE";

  return (
    <>
      {/* .dept-detail-header with the course code in the diploma's colours. */}
      <div
        className="mb-6 flex gap-[1.1rem] rounded-[10px] border border-l-4 border-border bg-card p-[1.35rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] max-[480px]:flex-col max-[480px]:p-[1.1rem]"
        style={{ borderLeftColor: department.bg }}
      >
        <div
          className="flex h-[52px] min-w-[52px] shrink-0 items-center justify-center self-start whitespace-nowrap rounded-md px-[0.6rem] text-[0.9rem] font-extrabold"
          style={{ background: department.bg, color: department.color }}
        >
          {course.code}
        </div>
        <div className="flex-1">
          <h1 className="mb-[0.35rem] font-heading text-[1.25rem] font-extrabold text-foreground">{course.name}</h1>
          <p className="mb-[0.6rem] text-[0.8rem] text-muted-foreground">
            <NavLink href={`/admin/diplomas/${department.id}`} className="font-semibold text-foreground">
              {department.name} ({department.code})
            </NavLink>
          </p>
          <div className="flex flex-wrap items-center gap-5 text-[0.78rem] text-muted-foreground">
            <span>{ordinal(department.semester)} Semester</span>
            <span className="inline-flex items-center gap-[0.35rem]">
              <Clock className="size-[13px]" aria-hidden /> {course.creditHours} Credit Hours
            </span>
            <StatusPill tone={active ? "success" : "muted"}>{active ? "Active" : "Inactive"}</StatusPill>
          </div>
        </div>
      </div>

      <CourseFees course={course} />

      <HeadingRow>
        <BlockHeading>Currently Taught By</BlockHeading>
      </HeadingRow>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {course.sectionLinks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className={cn(muted, "whitespace-normal p-6 text-center")}>
                  This course is not currently offered to any batch. Offer it from the Offer Courses page.
                </TableCell>
              </TableRow>
            ) : null}
            {course.sectionLinks.map((link) => (
              <TableRow key={link.id}>
                <TableCell className="font-semibold">
                  <NavLink href={`/admin/sections/${link.section.id}`}>Section {link.section.label}</NavLink>
                </TableCell>
                <TableCell>Batch {link.section.batch}</TableCell>
                <TableCell>{link.teacher ? link.teacher.name : <span className={muted}>No teacher assigned yet</span>}</TableCell>
                <TableCell>
                  {link.teacher ? (
                    <>
                      <div className="max-w-[220px] truncate text-mid-foreground">{link.teacher.email}</div>
                      <div className={muted}>{link.teacher.phone}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>

      <div className="mt-6">
        <HeadingRow
          action={
            <RowButton kind="edit" icon={Pencil} label="Edit" title="Edit assessment scheme" onClick={() => setEditingScheme(true)} />
          }
        >
          <BlockHeading>
            Assessment Scheme · Theory {course.theoryPercent}% / Practical {100 - course.theoryPercent}%
            {scheme.length > 0 && totalRemaining > 0.001 ? (
              <span className="text-[0.85em] font-semibold text-warning"> · {fmtPct(totalRemaining)} remaining</span>
            ) : null}
          </BlockHeading>
        </HeadingRow>
      </div>
      <TableCard className="mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assessment</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Weightage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheme.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className={cn(muted, "whitespace-normal p-6 text-center")}>
                  No assessments defined yet. Teachers&apos; marks sections come from this scheme.
                </TableCell>
              </TableRow>
            ) : null}
            {sortScheme(scheme).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-semibold">{markTypeLabel(e.type)}</TableCell>
                <TableCell>
                  <span className={cn("inline-block rounded-full px-[0.45rem] py-[0.1rem] text-[0.68rem] font-bold", COMPONENT_PILL[e.component])}>
                    {COMPONENT_LABELS[e.component]}
                  </span>
                </TableCell>
                <TableCell>{fmtPct(e.weightage)}</TableCell>
              </TableRow>
            ))}
            {scheme.length > 0
              ? schemeTotals.map((t) => (
                  <TableRow key={t.component} className="bg-muted hover:bg-muted">
                    <TableCell className="font-semibold">{COMPONENT_LABELS[t.component]} total</TableCell>
                    <TableCell />
                    <TableCell>
                      {fmtPct(t.assigned)} / {fmtPct(t.share)}
                      {t.remaining > 0.001 ? <span className="font-semibold text-warning"> · {fmtPct(t.remaining)} remaining</span> : null}
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </TableCard>

      {editingScheme ? <ClassicSchemeModal course={course} onClose={() => setEditingScheme(false)} /> : null}
    </>
  );
}

export default function CoursePage() {
  const id = Number(useParams().id);
  const query = useCourse(id);
  return (
    <PageContainer className="gap-0">
      <BackLink fallback="/admin/courses">Back to Courses</BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={6} />}>
          {({ course }) => <CourseBody course={course} />}
        </QueryView>
      </div>
    </PageContainer>
  );
}
