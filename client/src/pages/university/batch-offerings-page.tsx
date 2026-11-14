import { useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { BookMarked, Clock, Layers, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import {
  Alert,
  BackLink,
  BlockHeading,
  ClassicButton,
  ClassicConfirm,
  ClassicModal,
  DetailHeader,
  FieldError,
  FieldHint,
  FormGroup,
  FormLabel,
  inputErrorClass,
  ModalActions,
  RowButton,
  StatusPill,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { cn } from "@/lib/utils";
import { universityAction, useProgrammeLookup, useUniversityQuery } from "@/features/academics/api";
import { ordinal, runAction } from "@/features/academics/components/ui";

/**
 * One diploma's batch (admin): an exact replica of the old University
 * Portal's offering page - the courses offered to every section of the batch
 * (including ones from other diplomas of the programme), Offer Courses and
 * Cancel per course.
 */

interface BatchCourse {
  id: number;
  code: string;
  name: string;
  creditHours: number;
  status: "ACTIVE" | "INACTIVE";
  department: { id: number; code: string; name: string; semester: number };
  ownDiploma: boolean;
  offeredTo: { sectionId: number; label: string }[];
}

interface BatchOfferings {
  department: { id: number; name: string; code: string; category: string; semester: number; color: string; bg: string };
  batch: string;
  sections: { id: number; label: string }[];
  courses: BatchCourse[];
}

/** Picks one not-yet-offered course of the programme, grouped by its diploma. */
function AddOfferingModal({
  available,
  onClose,
  onOffer,
}: {
  available: BatchCourse[];
  onClose: () => void;
  onOffer: (courseId: number) => Promise<string | null>;
}) {
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const diplomas = [...new Map(available.map((c) => [c.department.id, c.department])).values()];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!courseId) return setError("Course is required");
    setSaving(true);
    const failed = await onOffer(Number(courseId));
    setSaving(false);
    if (failed) setError(failed);
    else onClose();
  }

  return (
    <ClassicModal open onClose={onClose} title="Offer Course">
      <form onSubmit={submit} noValidate>
        <FormGroup>
          <FormLabel htmlFor="add-offering-course" required>
            Course Code
          </FormLabel>
          {available.length === 0 ? (
            <FieldHint>Every course in this programme is already offered to this batch.</FieldHint>
          ) : (
            <Select
              id="add-offering-course"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setError("");
              }}
              className={cn(error && inputErrorClass)}
            >
              <option value="">Select a course…</option>
              {diplomas.map((d) => (
                <optgroup key={d.id} label={`${d.name} (${d.code}) · ${ordinal(d.semester)} Semester`}>
                  {available
                    .filter((c) => c.department.id === d.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          )}
          <FieldError>{error}</FieldError>
        </FormGroup>
        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={saving || available.length === 0}>
            {saving ? "Offering…" : "Offer Course"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}

export default function BatchOfferingsPage() {
  const params = useParams();
  const departmentId = Number(params.departmentId);
  const batch = decodeURIComponent(params.batch ?? "");
  const query = useUniversityQuery<BatchOfferings>(`/offerings/${departmentId}/${encodeURIComponent(batch)}`);
  const programmeOf = useProgrammeLookup();
  const [offering, setOffering] = useState(false);
  const [cancelling, setCancelling] = useState<BatchCourse | null>(null);

  async function offer(courseId: number) {
    const result = await universityAction<{ message?: string }>("post", "/offerings", { departmentId, courseId, batch });
    if (result.status !== "success") return result.message || "Failed to offer course.";
    toast.success(result.data?.message ?? "Course offered.");
    return null;
  }

  async function cancel() {
    if (!cancelling) return;
    const course = cancelling;
    setCancelling(null);
    await runAction(universityAction("post", "/offerings/remove", { departmentId, courseId: course.id, batch }));
  }

  return (
    <PageContainer className="gap-0">
      <BackLink fallback="/admin/offerings">Back to Offer Courses</BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={6} />}>
          {({ department, sections, courses }) => {
            if (sections.length === 0) {
              return <Alert>Batch {batch} has no sections in {department.name}.</Alert>;
            }
            const offered = courses.filter((c) => c.offeredTo.length > 0).sort((a, b) => a.code.localeCompare(b.code));
            const available = courses.filter((c) => c.offeredTo.length === 0);
            const programme = programmeOf(department.category);
            return (
              <>
                <DetailHeader
                  tile={department.code}
                  color={department.color}
                  bg={department.bg}
                  title={`Batch ${batch} · ${department.name}`}
                  subtitle="Courses offered to every section of this batch."
                  meta={
                    <>
                      {programme ? (
                        <span>
                          <Layers aria-hidden /> {programme.label}
                        </span>
                      ) : null}
                      <span>
                        <Users aria-hidden /> {sections.length} section{sections.length !== 1 ? "s" : ""}
                      </span>
                      <span>
                        <BookMarked aria-hidden /> {offered.length} course{offered.length !== 1 ? "s" : ""} offered
                      </span>
                    </>
                  }
                />

                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <BlockHeading className="mb-0">Offered Courses</BlockHeading>
                  <ClassicButton className="shrink-0" onClick={() => setOffering(true)}>
                    <Plus className="size-4" /> Offer Courses
                  </ClassicButton>
                </div>

                {offered.length === 0 ? (
                  <p className="px-4 py-14 text-center text-sm text-muted-foreground">No courses offered to this batch yet.</p>
                ) : (
                  <div className="flex flex-col gap-[0.6rem]">
                    {offered.map((c) => {
                      const active = c.status === "ACTIVE";
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-[0.9rem] rounded-md border border-border bg-card px-4 py-[0.85rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-[0_2px_8px_rgba(23,31,50,.07)] max-[720px]:flex-wrap"
                        >
                          <Link
                            href={`/admin/courses/${c.id}`}
                            className="flex min-w-0 flex-1 items-center gap-[0.9rem] max-[720px]:basis-full max-[720px]:flex-wrap"
                          >
                            <div
                              className="shrink-0 rounded-md px-[0.55rem] py-[0.3rem] text-[0.72rem] font-bold tracking-[0.03em]"
                              style={{ color: department.color, background: department.bg }}
                            >
                              {c.code}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.87rem] font-semibold text-foreground">{c.name}</p>
                              <div className="mt-[0.2rem] flex flex-wrap items-center gap-[0.6rem]">
                                <span className="whitespace-nowrap text-[0.74rem] text-muted-foreground">
                                  {ordinal(c.department.semester)} Semester
                                  {c.ownDiploma ? "" : ` · from ${c.department.code}`}
                                </span>
                              </div>
                            </div>
                            <StatusPill tone={active ? "success" : "muted"}>{active ? "Active" : "Inactive"}</StatusPill>
                            <div className="inline-flex shrink-0 items-center gap-[0.3rem] whitespace-nowrap text-xs font-semibold text-mid-foreground">
                              <Clock className="size-[13px]" aria-hidden /> {c.creditHours} CR
                            </div>
                          </Link>
                          <div className="flex shrink-0 gap-[0.4rem] max-[720px]:ml-auto">
                            <RowButton kind="delete" icon={X} label="Cancel" title="Cancel offering" onClick={() => setCancelling(c)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {offering ? <AddOfferingModal available={available} onClose={() => setOffering(false)} onOffer={offer} /> : null}
              </>
            );
          }}
        </QueryView>
      </div>
      <ClassicConfirm
        open={cancelling !== null}
        title="Cancel Course Offering"
        message={`Are you sure you want to stop offering ${cancelling?.code} to Batch ${batch}? Students will no longer see it; its assigned teachers are kept in case you offer it again.`}
        onConfirm={cancel}
        onCancel={() => setCancelling(null)}
      />
    </PageContainer>
  );
}
