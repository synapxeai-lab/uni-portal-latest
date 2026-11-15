import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput, TimeInput } from "@/components/ui/datetime-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploadField } from "@/components/files/attachment-upload-field";
import {
  PublishControls,
  type PublishMode,
} from "@/features/scheduling/components/publish-controls";
import { useTimeZone } from "@/components/providers/time-zone-provider";
import { fromDateTimeInputValue, toDateTimeInputParts } from "@/lib/datetime/format";

import { categoryLabel } from "@/features/academics/lib/marks";

import {
  createAssignmentAction,
  removeAssignmentAttachmentAction,
  updateAssignmentAction,
  useMarksCategories,
} from "../api";
import type { ActionResult, AssignmentSummary, MarksCategoryOption, TopicSummary } from "../types";

const initialState: ActionResult<AssignmentSummary> | null = null;

interface MarksheetState {
  /** null while loading, or when this classroom isn't a course section's (no marksheet). */
  categories: MarksCategoryOption[] | null;
  current: AssignmentSummary["marks"];
}

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

/**
 * Which marksheet category graded work counts in - digital assessments are
 * marked here and their marks reach the students' marksheet. Not rendered
 * until the categories load, so an edit saved before then keeps the current one.
 */
function MarksCategoryField({
  state,
  category,
  onCategoryChange,
  fieldError,
}: {
  state: MarksheetState;
  category: string;
  onCategoryChange: (value: string) => void;
  fieldError?: string;
}) {
  if (!state.categories || state.categories.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="assignment-marksCategory">Marksheet</Label>
      <Select
        id="assignment-marksCategory"
        name="marksCategory"
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">Not on marksheet</option>
        {state.categories.map((c) => {
          // A single exam (Mid Term) can only be on the marksheet once.
          const taken = c.singleAssessment && c.items > 0 && state.current?.category !== c.type;
          return (
            <option key={c.type} value={c.type} disabled={taken}>
              {categoryLabel(c.type)}
              {c.weightage ? ` · ${pct(c.weightage)}` : ""}
              {taken ? " (added)" : ""}
            </option>
          );
        })}
      </Select>
      {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
    </div>
  );
}

/** The item's own weightage, within what its category has left. */
function MarksWeightageField({
  state,
  category,
  current,
  fieldError,
}: {
  state: MarksheetState;
  category: string;
  current: AssignmentSummary["marks"];
  fieldError?: string;
}) {
  const selected = state.categories?.find((c) => c.type === category);
  if (!selected) {
    return null;
  }
  const sameCategory = current?.category === category;
  // The assignment's own share is free to re-use when it stays in the same category.
  const left = selected.weightage
    ? Math.max(0, selected.weightage - selected.allocated + (sameCategory ? (current?.weightage ?? 0) : 0))
    : null;
  const label = categoryLabel(selected.type);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="assignment-marksWeightage">Weightage (%)</Label>
      <Input
        // A different category starts empty: the old share doesn't carry over.
        key={category}
        id="assignment-marksWeightage"
        name="marksWeightage"
        type="number"
        min={0}
        max={left ?? undefined}
        step="any"
        placeholder={left === null ? "Not weighted" : "Share what's left"}
        defaultValue={sameCategory ? (current?.weightage ?? "") : ""}
        disabled={left === null}
        className="w-40"
      />
      <p className="text-xs text-muted-foreground">
        {left === null
          ? `${label} has no weightage in the course's assessment scheme.`
          : `${label} carries ${pct(selected.weightage!)}; up to ${pct(left)} is left for this one. ` +
            "Leave empty to share what's left of the category by marks."}
      </p>
      {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
    </div>
  );
}

interface AssignmentFormDialogProps {
  mode: "create" | "edit";
  classroomId: string;
  assignment?: AssignmentSummary;
  topics: TopicSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignmentFormDialog({
  mode,
  classroomId,
  assignment,
  topics,
  open,
  onOpenChange,
}: AssignmentFormDialogProps) {
  const router = useRouter();
  const action = mode === "create" ? createAssignmentAction : updateAssignmentAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [publishMode, setPublishMode] = useState<PublishMode>("PUBLISHED");
  const [scheduledFor, setScheduledFor] = useState("");
  const [attachments, setAttachments] = useState(assignment?.attachments ?? []);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();
  const timeZone = useTimeZone();
  const [initialDue] = useState(() => toDateTimeInputParts(assignment?.dueDate, timeZone));
  const [dueDay, setDueDay] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time);
  const marksCategories = useMarksCategories(classroomId, open);
  const marksheet: MarksheetState = {
    categories: marksCategories.data?.categories ?? null,
    current: assignment?.marks ?? null,
  };
  const [marksCategory, setMarksCategory] = useState(assignment?.marks?.category ?? "");

  // Reopening starts from where the assignment is now (it may have changed since).
  useEffect(() => {
    if (open) {
      setMarksCategory(assignment?.marks?.category ?? "");
    }
  }, [open, assignment?.marks?.category]);

  // Separate date and time fields: a single datetime-local input reports no
  // value at all until both halves are filled, which made it impossible to
  // default the time without clobbering one the teacher had just picked.
  // Picking a date only fills in the Google Classroom-style 23:59 "end of
  // day" default while the time is still empty.
  function handleDueDayChange(value: string) {
    setDueDay(value);
    if (value && !dueTime) {
      setDueTime("23:59");
    }
  }

  function clearDueDate() {
    setDueDay("");
    setDueTime("");
  }

  // The picker shows wall-clock time in the teacher's zone; the server gets
  // the exact instant, so it can never be re-read in the server's own zone.
  const dueInstant = dueDay
    ? fromDateTimeInputValue(`${dueDay}T${dueTime || "23:59"}`, timeZone)
    : null;
  const dueDateValue = dueInstant ? dueInstant.toISOString() : "";

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success(mode === "create" ? "Assignment saved" : "Assignment updated");
      onOpenChange(false);
      formRef.current?.reset();
      if (mode === "create") {
        startTransition(() => {
          clearDueDate();
          setPublishMode("PUBLISHED");
        });
      }
      router.refresh();
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleRemoveAttachment(fileAttachmentId: string) {
    if (!assignment) {
      return;
    }
    setRemovingAttachmentId(fileAttachmentId);
    startRemoveTransition(async () => {
      const result = await removeAssignmentAttachmentAction(
        classroomId,
        assignment.id,
        fileAttachmentId,
      );
      if (result.status === "success") {
        setAttachments((previous) => previous.filter((item) => item.id !== fileAttachmentId));
        toast.success("Attachment removed");
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setRemovingAttachmentId(null);
    });
  }

  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form ref={formRef} action={formAction}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create assignment" : "Edit assignment"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Give your class work to complete."
                : "Update the assignment's details."}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="classroomId" value={classroomId} />
          {mode === "edit" && assignment ? (
            <input type="hidden" name="assignmentId" value={assignment.id} />
          ) : null}

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignment-title">Title</Label>
              <Input
                id="assignment-title"
                name="title"
                defaultValue={assignment?.title}
                required
                maxLength={150}
                autoFocus
              />
              {fieldErrors?.title ? (
                <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignment-description">Instructions</Label>
              <Textarea
                id="assignment-description"
                name="description"
                defaultValue={assignment?.description ?? ""}
                rows={4}
                maxLength={5000}
              />
              {fieldErrors?.description ? (
                <p className="text-xs text-destructive">{fieldErrors.description[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="assignment-dueDay">Due</Label>
                {dueDay ? (
                  <button
                    type="button"
                    onClick={clearDueDate}
                    className="text-xs font-medium text-link"
                  >
                    No due date
                  </button>
                ) : null}
              </div>
              <input type="hidden" name="dueDate" value={dueDateValue} />
              <div className="grid grid-cols-[3fr_2fr] gap-3">
                <DateInput
                  id="assignment-dueDay"
                  aria-label="Due date"
                  value={dueDay}
                  onChange={(event) => handleDueDayChange(event.target.value)}
                />
                <TimeInput
                  aria-label="Due time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                  disabled={!dueDay}
                />
              </div>
              {fieldErrors?.dueDate ? (
                <p className="text-xs text-destructive">{fieldErrors.dueDate[0]}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assignment-points">Points</Label>
                <Input
                  id="assignment-points"
                  name="points"
                  type="number"
                  min={0}
                  max={100000}
                  placeholder="Ungraded"
                  defaultValue={assignment?.points ?? ""}
                />
                {fieldErrors?.points ? (
                  <p className="text-xs text-destructive">{fieldErrors.points[0]}</p>
                ) : null}
              </div>
              <MarksCategoryField
                state={marksheet}
                category={marksCategory}
                onCategoryChange={setMarksCategory}
                fieldError={fieldErrors?.marksCategory?.[0]}
              />
            </div>
            <MarksWeightageField
              state={marksheet}
              category={marksCategory}
              current={assignment?.marks ?? null}
              fieldError={fieldErrors?.marksWeightage?.[0]}
            />

            <label
              htmlFor="assignment-allowLateSubmission"
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <input
                id="assignment-allowLateSubmission"
                name="allowLateSubmission"
                type="checkbox"
                defaultChecked={assignment?.allowLateSubmission ?? true}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Accept work after the due date
                </span>
                <span className="text-xs text-muted-foreground">
                  Late work is marked Late. When off, students can&apos;t turn in work once the due
                  date has passed.
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignment-topic">Topic</Label>
              <Select id="assignment-topic" name="topicId" defaultValue={assignment?.topicId ?? ""}>
                <option value="">No topic</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </Select>
              {fieldErrors?.topicId ? (
                <p className="text-xs text-destructive">{fieldErrors.topicId[0]}</p>
              ) : null}
            </div>

            <AttachmentUploadField
              id="assignment-files"
              label="Attachments"
              existingAttachments={mode === "edit" ? attachments : undefined}
              onRemoveExisting={mode === "edit" ? handleRemoveAttachment : undefined}
              removingId={isRemoving ? removingAttachmentId : null}
              disabled={isPending}
            />

            {mode === "create" ? (
              <PublishControls
                mode={publishMode}
                onModeChange={setPublishMode}
                scheduledFor={scheduledFor}
                onScheduledForChange={setScheduledFor}
                fieldError={fieldErrors?.scheduledFor?.[0]}
                disabled={isPending}
                publishLabel="Assign"
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : mode === "edit"
                  ? "Save"
                  : publishMode === "DRAFT"
                    ? "Save draft"
                    : publishMode === "SCHEDULED"
                      ? "Schedule"
                      : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
