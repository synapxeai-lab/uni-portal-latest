import { useState, type FormEvent } from "react";
import { Percent, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Alert,
  ClassicButton,
  ClassicModal,
  FieldError,
  FieldHint,
  FormGroup,
  FormLabel,
  FormRow,
  inputErrorClass,
  ModalActions,
} from "@/components/classic/classic";
import { cn } from "@/lib/utils";

import { universityAction } from "../api";
import type { CourseDetail, ExtraFee, SchemeEntry } from "../types";

/** Exact replicas of the old University Portal's course modals: assessment scheme and extra fee. */

// ---- Assessment labels (old portal wording) ---------------------------------------------

export const MARK_TYPE_LABELS: Record<string, string> = {
  QUIZ: "Quizzes",
  ASSIGNMENT: "Assignments",
  MID: "Mid Term",
  PROJECT: "Projects",
  LAB: "Lab Work",
  PRACTICAL: "Practical Exam",
  FINAL: "Final Term",
};
const MARK_TYPE_ORDER = ["QUIZ", "ASSIGNMENT", "MID", "PROJECT", "LAB", "PRACTICAL", "FINAL"];
/** An assessment's type is its admin-given name; older ones use the built-in codes above. */
export const markTypeLabel = (type: string) => MARK_TYPE_LABELS[type] ?? type;
const typeRank = (type: string) => {
  const i = MARK_TYPE_ORDER.indexOf(type);
  return i === -1 ? MARK_TYPE_ORDER.length : i;
};
/** A course's scheme entries in marks-page order: built-in types first. */
export const sortScheme = <T extends { type: string }>(entries: T[] = []) => [...entries].sort((a, b) => typeRank(a.type) - typeRank(b.type));

export const COMPONENT_LABELS: Record<string, string> = { THEORY: "Theory", PRACTICAL: "Practical" };
/** The theory/practical pill (.component-pill). */
export const COMPONENT_PILL: Record<string, string> = {
  THEORY: "bg-[#e8f1fd] text-[#1565c0] dark:bg-info-soft dark:text-info",
  PRACTICAL: "bg-[#fef3c7] text-[#b45309] dark:bg-warning-soft dark:text-warning",
};

const fmtWeight = (n: number) => `${Math.round(n * 100) / 100}%`;
const isClose = (a: number, b: number) => Math.abs(a - b) < 0.001;
const isOver = (sum: number, target: number) => sum > target && !isClose(sum, target);

// ---- Assessment scheme ------------------------------------------------------------------

interface Row {
  key: number;
  id?: number;
  type: string;
  name: string;
  component: string;
  weightage: string;
}

let nextKey = 0;
// Names offered while typing; admins can use any name.
const SUGGESTED_NAMES = Object.values(MARK_TYPE_LABELS);
// Names that sound practical default to the practical component.
const looksPractical = (name: string) => /lab|practical/i.test(name);
const sumOf = (rows: Row[], component: string) =>
  rows.filter((r) => r.component === component).reduce((s, r) => s + (Number(r.weightage) || 0), 0);

/**
 * Sets a course's theory/practical split and its named assessment sections,
 * each theory or practical with a weightage. Neither side may go over its
 * share; a scheme below 100% can be saved and the rest shows as remaining.
 */
export function ClassicSchemeModal({ course, onClose }: { course: CourseDetail; onClose: () => void }) {
  const [theory, setTheory] = useState(String(course.theoryPercent ?? 100));
  // `type` is the saved name (an unchanged built-in one like QUIZ is sent back as is); `name` is shown and edited.
  const [rows, setRows] = useState<Row[]>(() =>
    sortScheme<SchemeEntry>(course.assessmentScheme ?? []).map((e) => ({
      key: nextKey++,
      id: e.id,
      type: e.type,
      name: markTypeLabel(e.type),
      component: e.component,
      weightage: String(e.weightage),
    })),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const theoryPercent = Number(theory);
  const theoryValid = theory !== "" && Number.isInteger(theoryPercent) && theoryPercent >= 0 && theoryPercent <= 100;
  const practicalPercent = theoryValid ? 100 - theoryPercent : 0;
  const theorySum = sumOf(rows, "THEORY");
  const practicalSum = sumOf(rows, "PRACTICAL");
  const nameKey = (r: Row) => r.name.trim().toLowerCase();
  const isDuplicate = (r: Row) => nameKey(r) !== "" && rows.filter((o) => nameKey(o) === nameKey(r)).length > 1;
  const rowsValid = rows.every((r) => r.name.trim() !== "" && !isDuplicate(r) && r.weightage !== "" && Number(r.weightage) > 0);
  const totalsOk = !isOver(theorySum, theoryPercent) && !isOver(practicalSum, practicalPercent);
  const canSave = theoryValid && rowsValid && totalsOk;
  const unusedSuggestions = SUGGESTED_NAMES.filter((n) => !rows.some((r) => nameKey(r) === n.toLowerCase()));

  const update = (i: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setError("");
  };
  const rename = (i: number, name: string) => {
    const patch: Partial<Row> = { name };
    // Pick the practical side for a practical-sounding name typed into a fresh row.
    if (!rows[i].id && practicalPercent > 0) patch.component = looksPractical(name) ? "PRACTICAL" : "THEORY";
    update(i, patch);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError("");
    const result = await universityAction("put", `/courses/${course.id}/assessment-scheme`, {
      theoryPercent,
      entries: rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        type: r.type && r.name.trim() === markTypeLabel(r.type) ? r.type : r.name.trim(),
        component: r.component,
        weightage: Number(r.weightage),
      })),
    });
    setSaving(false);
    if (result.status !== "success") return setError(result.message || "Failed to save the assessment scheme.");
    toast.success((result.data as { message?: string }).message ?? "Assessment scheme saved.");
    onClose();
  }

  const totalLine = (label: string, sum: number, target: number) => {
    const ok = isClose(sum, target);
    return (
      <div
        className={cn(
          "flex justify-between rounded-lg border px-3 py-[0.45rem] text-[0.82rem] font-semibold",
          ok
            ? "border-[#bbf7d0] bg-[#dcfce7] text-[#166534] dark:border-success-border dark:bg-success-soft dark:text-success"
            : "border-warning-border bg-warning-soft text-warning",
        )}
      >
        <span>{label}</span>
        <span>
          {fmtWeight(sum)} / {fmtWeight(target)}
          {!ok && ` · ${sum < target ? `${fmtWeight(target - sum)} left` : `${fmtWeight(sum - target)} over`}`}
        </span>
      </div>
    );
  };

  return (
    <ClassicModal open onClose={onClose} title={`Assessment Scheme · ${course.code}`} width={600}>
      {error ? <Alert>{error}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <FormRow>
          <FormGroup>
            <FormLabel htmlFor="scheme-theory" required>
              Theory (%)
            </FormLabel>
            <Input
              id="scheme-theory"
              type="number"
              min={0}
              max={100}
              step={1}
              value={theory}
              onChange={(e) => {
                setTheory(e.target.value);
                setError("");
              }}
              className={cn(!theoryValid && inputErrorClass)}
            />
            {!theoryValid ? <FieldError>Enter a whole number from 0 to 100</FieldError> : null}
          </FormGroup>
          <FormGroup>
            <FormLabel htmlFor="scheme-practical">Practical (%)</FormLabel>
            <Input id="scheme-practical" value={theoryValid ? practicalPercent : ""} readOnly disabled />
            <FieldHint>The rest of the course after theory.</FieldHint>
          </FormGroup>
        </FormRow>

        <FormLabel>Assessments</FormLabel>
        {rows.length === 0 ? (
          <FieldHint className="mb-3">
            No assessments yet. Add the sections teachers will mark and name them as you like, e.g. Quizzes, Mid Term, Lab Work.
          </FieldHint>
        ) : (
          <div className="mb-3 flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-[1.4fr_1fr_110px_auto] items-center gap-2 max-[520px]:grid-cols-2">
                <Input
                  type="text"
                  aria-label="Assessment name"
                  placeholder="e.g. Class Test"
                  maxLength={40}
                  list="assessment-name-suggestions"
                  value={r.name}
                  autoFocus={!r.id && r.name === ""}
                  title={isDuplicate(r) ? "Each assessment needs a different name" : undefined}
                  onChange={(e) => rename(i, e.target.value)}
                  className={cn(isDuplicate(r) && inputErrorClass)}
                />
                <Select aria-label="Theory or practical" value={r.component} onChange={(e) => update(i, { component: e.target.value })}>
                  {Object.entries(COMPONENT_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center gap-[0.35rem]">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    placeholder="0"
                    aria-label="Weightage"
                    value={r.weightage}
                    onChange={(e) => update(i, { weightage: e.target.value })}
                    className={cn(r.weightage !== "" && !(Number(r.weightage) > 0) && inputErrorClass)}
                  />
                  <Percent className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRows((rs) => rs.filter((_, j) => j !== i));
                    setError("");
                  }}
                  title={`Remove ${r.name || "assessment"}`}
                  aria-label={`Remove ${r.name || "assessment"}`}
                  className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-card text-destructive transition-colors hover:border-destructive-border hover:bg-destructive-soft"
                >
                  <Trash2 className="size-[13px]" />
                </button>
              </div>
            ))}
          </div>
        )}

        <datalist id="assessment-name-suggestions">
          {unusedSuggestions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <ClassicButton
          variant="outline"
          className="px-3 py-[0.35rem] text-[0.8rem]"
          onClick={() => {
            setRows((rs) => [...rs, { key: nextKey++, type: "", name: "", component: "THEORY", weightage: "" }]);
            setError("");
          }}
        >
          <Plus className="size-3.5" /> Add Assessment
        </ClassicButton>

        {rows.length > 0 && theoryValid ? (
          <div className="mt-4 flex flex-col gap-[0.4rem]">
            {totalLine("Theory", theorySum, theoryPercent)}
            {totalLine("Practical", practicalSum, practicalPercent)}
          </div>
        ) : null}

        <FieldHint className="mt-3">
          Saving updates the marks sections in every class section offered this course. Teachers then add items (Quiz 1, Quiz 2…)
          and enter marks.
        </FieldHint>

        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </ClassicButton>
          <ClassicButton
            type="submit"
            disabled={!canSave || saving}
            title={
              canSave
                ? undefined
                : "Every assessment needs its own name and a weightage, and theory and practical can't go over their share"
            }
          >
            {saving ? "Saving…" : "Save Scheme"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}

// ---- Extra fee ---------------------------------------------------------------------------

const SUGGESTED_FEES = ["Tuition Fee", "Stationery Fee", "Uniform Fee", "Lab Fee", "Exam Fee", "Registration Fee"];

export function ClassicExtraFeeModal({ course, fee, onClose }: { course: CourseDetail; fee?: ExtraFee; onClose: () => void }) {
  const isEdit = Boolean(fee);
  const [name, setName] = useState(fee?.name ?? "");
  const [amount, setAmount] = useState(fee ? String(fee.amount) : "");
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});
  const [apiErr, setApiErr] = useState("");
  const [saving, setSaving] = useState(false);
  const usedNames = new Set(course.extraFees.filter((f) => f.id !== fee?.id).map((f) => f.name.toLowerCase()));
  const suggestions = SUGGESTED_FEES.filter((n) => !usedNames.has(n.toLowerCase()));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { name?: string; amount?: string } = {};
    const n = Number(amount);
    if (!name.trim()) errs.name = "Fee name is required";
    else if (usedNames.has(name.trim().toLowerCase())) errs.name = "This course already has a fee with this name";
    if (amount === "" || !Number.isInteger(n) || n <= 0) errs.amount = "Enter an amount in whole rupees (more than 0)";
    if (Object.keys(errs).length) return setErrors(errs);
    setSaving(true);
    setApiErr("");
    const body = { name: name.trim(), amount: n };
    const result = fee
      ? await universityAction("put", `/courses/${course.id}/fees/${fee.id}`, body)
      : await universityAction("post", `/courses/${course.id}/fees`, body);
    setSaving(false);
    if (result.status !== "success") return setApiErr(result.message || "Something went wrong. Please try again.");
    const message = (result.data as { message?: string }).message;
    if (message) toast.success(message);
    onClose();
  }

  return (
    <ClassicModal open onClose={onClose} title={`${isEdit ? "Edit Fee" : "Add Fee"} · ${course.code}`}>
      {apiErr ? <Alert>{apiErr}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <FormGroup>
          <FormLabel htmlFor="fee-name" required>
            Fee Name
          </FormLabel>
          <Input
            id="fee-name"
            type="text"
            value={name}
            maxLength={60}
            list="extra-fee-names"
            autoFocus
            autoComplete="off"
            placeholder="e.g. Uniform Fee"
            className={cn(errors.name && inputErrorClass)}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: "" }));
              setApiErr("");
            }}
          />
          <datalist id="extra-fee-names">
            {suggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <FieldError>{errors.name}</FieldError>
        </FormGroup>
        <FormGroup>
          <FormLabel htmlFor="fee-amount" required>
            Amount (Rs.)
          </FormLabel>
          <Input
            id="fee-amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            placeholder="e.g. 3000"
            className={cn(errors.amount && inputErrorClass)}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors((p) => ({ ...p, amount: "" }));
              setApiErr("");
            }}
          />
          {errors.amount ? (
            <FieldError>{errors.amount}</FieldError>
          ) : (
            <FieldHint>Added to the course&apos;s total fee, which students are charged when they register.</FieldHint>
          )}
        </FormGroup>
        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Fee"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}
