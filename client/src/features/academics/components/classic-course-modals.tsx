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
export function ClassicSchemeModal({
  course,
  onClose,
}: {
  course: Pick<CourseDetail, "id" | "code" | "theoryPercent"> & { assessmentScheme?: SchemeEntry[] };
  onClose: () => void;
}) {
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

// ---- Add / Edit course -------------------------------------------------------------------

export const formatPKR = (n: number) => `Rs. ${(Number(n) || 0).toLocaleString("en-PK")}`;
/** `amount` with `rate` percent off, in whole rupees (matches the server's fee rules). */
export const applyDiscount = (amount: number, rate: number) => Math.round(amount * (1 - (rate || 0) / 100));

/** A fee after its discount; when discounted, the original is struck through with the rate. */
export function FeeAmount({ fee = 0, discountRate = 0 }: { fee?: number; discountRate?: number }) {
  const cls = "inline-flex items-baseline gap-[0.35rem] whitespace-nowrap text-xs font-semibold text-mid-foreground";
  if (!discountRate) return <span className={cls}>{formatPKR(fee)}</span>;
  return (
    <span className={cls}>
      {formatPKR(applyDiscount(fee, discountRate))}
      <s className="font-medium text-muted-foreground">{formatPKR(fee)}</s>
      <span className="text-[0.68rem] font-bold text-[#166534] dark:text-success">−{discountRate}%</span>
    </span>
  );
}

interface CourseForm {
  departmentId: string;
  departmentIds: number[];
  name: string;
  code: string;
  creditHours: string;
  fee: string;
  discountRate: string;
}

type CourseErrors = Partial<Record<keyof CourseForm, string>>;

/**
 * Add / Edit Course: adding ticks every diploma the course belongs to (each
 * gets its own copy); editing moves one copy between diplomas.
 */
export function ClassicCourseModal({
  departments,
  categories,
  course,
  onClose,
}: {
  departments: { id: number; name: string; code: string; category: string }[];
  categories: { key: string; label: string }[];
  course?: {
    id: number;
    departmentId: number;
    name: string;
    code: string;
    creditHours: number;
    fee: number;
    discountRate: number;
    extraFees?: ExtraFee[];
  };
  onClose: () => void;
}) {
  const isEdit = Boolean(course);
  // Extra fees (Uniform Fee…) are managed on the course page but count towards what's payable.
  const extraFeesTotal = (course?.extraFees ?? []).reduce((sum, f) => sum + f.amount, 0);
  const [form, setForm] = useState<CourseForm>(() =>
    course
      ? {
          departmentId: String(course.departmentId),
          departmentIds: [],
          name: course.name,
          code: course.code,
          creditHours: String(course.creditHours),
          fee: String(course.fee ?? 0),
          discountRate: String(course.discountRate ?? 0),
        }
      : {
          departmentId: "",
          departmentIds: departments[0] ? [departments[0].id] : [],
          name: "",
          code: "",
          creditHours: "3",
          fee: "0",
          discountRate: "0",
        },
  );
  const [errors, setErrors] = useState<CourseErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiErr, setApiErr] = useState("");

  const set = (name: keyof CourseForm, value: string) => {
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
    setApiErr("");
  };
  const toggleDepartment = (id: number) => {
    setForm((p) => ({
      ...p,
      departmentIds: p.departmentIds.includes(id) ? p.departmentIds.filter((d) => d !== id) : [...p.departmentIds, id],
    }));
    setErrors((p) => ({ ...p, departmentId: "" }));
    setApiErr("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: CourseErrors = {};
    if (isEdit ? !form.departmentId : form.departmentIds.length === 0) {
      errs.departmentId = isEdit ? "Diploma is required" : "Select at least one diploma";
    }
    if (!form.name.trim()) errs.name = "Course name is required";
    if (!form.code.trim()) errs.code = "Course code is required";
    if (!form.creditHours || Number(form.creditHours) < 1) errs.creditHours = "Enter a valid credit hours value";
    const fee = Number(form.fee);
    if (form.fee === "" || !Number.isInteger(fee) || fee < 0) errs.fee = "Enter a fee in whole rupees (0 or more)";
    const rate = Number(form.discountRate);
    if (form.discountRate === "" || Number.isNaN(rate) || rate < 0 || rate > 100) {
      errs.discountRate = "Discount must be from 0 to 100";
    }
    if (Object.keys(errs).length) return setErrors(errs);

    setLoading(true);
    setApiErr("");
    const payload = {
      ...(isEdit ? { departmentId: Number(form.departmentId) } : { departmentIds: form.departmentIds }),
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      creditHours: Number(form.creditHours),
      fee,
      discountRate: rate,
    };
    const result = course
      ? await universityAction("put", `/courses/${course.id}`, payload)
      : await universityAction("post", "/courses", payload);
    setLoading(false);
    if (result.status !== "success") return setApiErr(result.message || "Something went wrong. Please try again.");
    const copies = (result.data as { courses?: unknown[] } | undefined)?.courses?.length ?? 1;
    const action = isEdit ? "updated" : copies > 1 ? `added to ${copies} programmes` : "created";
    toast.success(`Course ${payload.name} ${action} successfully.`);
    onClose();
  }

  const field = (
    name: "name" | "code" | "creditHours",
    label: string,
    placeholder: string,
    extra?: React.ComponentProps<"input">,
  ) => (
    <FormGroup>
      <FormLabel htmlFor={`course-${name}`} required>
        {label}
      </FormLabel>
      <Input
        id={`course-${name}`}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(errors[name] && inputErrorClass)}
        {...extra}
      />
      <FieldError>{errors[name]}</FieldError>
    </FormGroup>
  );

  return (
    <ClassicModal open onClose={onClose} title={isEdit ? "Edit Course" : "Add Course"} width={980}>
      {apiErr ? <Alert>{apiErr}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-3 gap-x-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          {!isEdit ? (
            <FormGroup className="col-span-full">
              <FormLabel required>Diplomas</FormLabel>
              <div
                className={cn(
                  "flex max-h-[240px] flex-col gap-[0.6rem] overflow-y-auto rounded-md border border-border px-3 py-[0.6rem]",
                  errors.departmentId && "border-destructive",
                )}
              >
                {categories.map((c) => (
                  <fieldset key={c.key} className="m-0 flex flex-col gap-[0.3rem] border-0 p-0">
                    <legend className="mb-[0.2rem] text-[0.7rem] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                      {c.label}
                    </legend>
                    {departments
                      .filter((d) => d.category === c.key)
                      .map((d) => (
                        <label key={d.id} className="flex cursor-pointer items-start gap-2 text-[0.84rem] text-foreground">
                          <input
                            type="checkbox"
                            className="mt-[0.2rem] shrink-0 accent-primary"
                            checked={form.departmentIds.includes(d.id)}
                            onChange={() => toggleDepartment(d.id)}
                          />
                          <span>
                            {d.name} ({d.code})
                          </span>
                        </label>
                      ))}
                  </fieldset>
                ))}
              </div>
              <FieldHint>Tick every programme this course is part of; each gets its own copy.</FieldHint>
              <FieldError>{errors.departmentId}</FieldError>
            </FormGroup>
          ) : (
            <FormGroup>
              <FormLabel htmlFor="course-department" required>
                Diploma
              </FormLabel>
              <Select
                id="course-department"
                value={form.departmentId}
                onChange={(e) => set("departmentId", e.target.value)}
                className={cn(errors.departmentId && inputErrorClass)}
              >
                {categories.map((c) => (
                  <optgroup key={c.key} label={c.label}>
                    {departments
                      .filter((d) => d.category === c.key)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              <FieldError>{errors.departmentId}</FieldError>
            </FormGroup>
          )}

          {field("name", "Course Name", "e.g. Introduction to Programming")}
          {field("code", "Course Code", "e.g. CS901")}
          {field("creditHours", "Credit Hours", "e.g. 3", { type: "number", min: 1, max: 100 })}

          <FormGroup>
            <FormLabel htmlFor="course-fee" required>
              Fee (Rs.)
            </FormLabel>
            <Input
              id="course-fee"
              type="number"
              min={0}
              step={1}
              value={form.fee}
              onChange={(e) => set("fee", e.target.value)}
              placeholder="e.g. 25000"
              className={cn(errors.fee && inputErrorClass)}
            />
            {errors.fee ? (
              <FieldError>{errors.fee}</FieldError>
            ) : extraFeesTotal > 0 ? (
              <FieldHint>Plus {formatPKR(extraFeesTotal)} in extra fees, set on the course page.</FieldHint>
            ) : null}
          </FormGroup>
          <FormGroup>
            <FormLabel htmlFor="course-discount" required>
              Discount (%)
            </FormLabel>
            <Input
              id="course-discount"
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.discountRate}
              onChange={(e) => set("discountRate", e.target.value)}
              placeholder="0"
              className={cn(errors.discountRate && inputErrorClass)}
            />
            {errors.discountRate ? (
              <FieldError>{errors.discountRate}</FieldError>
            ) : (
              <FieldHint>
                Payable: {formatPKR(applyDiscount((Number(form.fee) || 0) + extraFeesTotal, Number(form.discountRate) || 0))}
              </FieldHint>
            )}
          </FormGroup>
        </div>
        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Course"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}
