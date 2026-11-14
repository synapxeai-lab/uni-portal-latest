import { useState, type ChangeEvent, type FormEvent } from "react";
import { CalendarClock, CalendarRange, CircleStop, Plus, Settings2, Trash2, X } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ActionMenu,
  ActionMenuDivider,
  ActionMenuItem,
  Alert,
  CardGrid,
  ClassicButton,
  ClassicConfirm,
  ClassicModal,
  DetailCard,
  FieldError,
  FieldHint,
  FormGroup,
  FormLabel,
  FormRow,
  inputErrorClass,
  ModalActions,
  StatusPill,
  TableEmpty,
  useViewMode,
  ViewToggle,
  type PillTone,
} from "@/components/classic/classic";
import { ListSkeleton } from "@/components/states/skeletons";
import { QueryView } from "@/app/route-states";
import { universityAction, useBatches, useUniversityQuery } from "@/features/academics/api";
import { runAction, TableCard } from "@/features/academics/components/ui";
import { cn } from "@/lib/utils";

/**
 * Registration periods (admin): an exact replica of the old University
 * Portal's Registration page - Cards/List toggle, ☰ actions menu, and its
 * Start / Semester Period / Credit Limits modals.
 */

interface Registration {
  id: number;
  semester: Semester;
  year: number;
  startDate: Date;
  endDate: Date;
  closedAt: Date | null;
  semesterStart: Date | null;
  semesterEnd: Date | null;
  semesterEndedAt: Date | null;
  status: "UPCOMING" | "ACTIVE" | "CLOSED";
  limits: { id: number; batch: string; creditLimit: number }[];
  _count: { enrollments: number; challans: number };
}

type Semester = "SPRING" | "SUMMER" | "FALL";
const SEMESTERS: Semester[] = ["SPRING", "SUMMER", "FALL"];
const SEMESTER_LABELS: Record<Semester, string> = { SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };
const DEFAULT_CREDIT_LIMIT = 40;

const STATUS_META: Record<Registration["status"], { label: string; tone: PillTone }> = {
  UPCOMING: { label: "Upcoming", tone: "primary" },
  ACTIVE: { label: "Active", tone: "success" },
  CLOSED: { label: "Closed", tone: "muted" },
};

const name = (r: Pick<Registration, "semester" | "year">) => `${SEMESTER_LABELS[r.semester]} ${r.year}`;
const formatDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const periodText = (r: Registration) =>
  r.semesterStart && r.semesterEnd ? `${formatDate(r.semesterStart)} – ${formatDate(r.semesterEnd)}` : "Not set";
const limitsText = (r: Registration) =>
  r.limits.length > 0
    ? `${r.limits.length} batch credit override${r.limits.length === 1 ? "" : "s"}`
    : `Default limit: ${DEFAULT_CREDIT_LIMIT} CR for every batch`;
// Dates are stored at midnight UTC of the picked day: the ISO date is the input's value.
const toInputDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// Semester windows: Spring = Jan-May, Summer = Jun-Aug, Fall = Sep-Dec. Only previews the
// year the server computes for the new registration.
const SEMESTER_END_MONTH: Record<Semester, number> = { SPRING: 4, SUMMER: 7, FALL: 11 };
function computeRegistrationYear(semester: Semester, now = new Date()) {
  const year = now.getFullYear();
  const windowEnd = new Date(year, SEMESTER_END_MONTH[semester] + 1, 0, 23, 59, 59, 999);
  return now > windowEnd ? year + 1 : year;
}

const deleteMessage = (r: Registration) => {
  const { enrollments, challans } = r._count;
  const parts = [
    enrollments > 0 && `${enrollments} course enrollment${enrollments === 1 ? "" : "s"} (with their attendance and marks)`,
    challans > 0 && `${challans} fee challan${challans === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `Delete the ${name(r)} registration?${parts.length ? ` This also deletes ${parts.join(" and ")}.` : ""} This cannot be undone.`;
};

// ---- Form helpers ------------------------------------------------------------------------

type Errors = Partial<Record<string, string>>;
type PeriodForm = { semesterStart: string; semesterEnd: string };

function validateSemesterPeriod(form: PeriodForm): Errors {
  const e: Errors = {};
  if (!form.semesterStart) e.semesterStart = "Semester start is required";
  if (!form.semesterEnd) e.semesterEnd = "Semester end is required";
  if (form.semesterStart && form.semesterEnd && new Date(form.semesterEnd) <= new Date(form.semesterStart)) {
    e.semesterEnd = "Semester end must be after the semester start";
  }
  return e;
}

function DateField({
  label,
  name: field,
  value,
  error,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  error?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <FormGroup>
      <FormLabel htmlFor={field} required>
        {label}
      </FormLabel>
      <Input id={field} name={field} type="date" value={value} onChange={onChange} className={cn(error && inputErrorClass)} />
      <FieldError>{error}</FieldError>
    </FormGroup>
  );
}

/** The semester's start/end inputs, shared by the start and edit modals. */
function SemesterPeriodFields({ form, errors, onChange }: { form: PeriodForm; errors: Errors; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <FormRow>
      <DateField label="Semester Start" name="semesterStart" value={form.semesterStart} error={errors.semesterStart} onChange={onChange} />
      <DateField label="Semester End" name="semesterEnd" value={form.semesterEnd} error={errors.semesterEnd} onChange={onChange} />
    </FormRow>
  );
}

function useForm<T extends Record<string, string>>(initial: T) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [apiErr, setApiErr] = useState("");
  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name: field, value } = e.target;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setApiErr("");
  };
  return { form, errors, setErrors, apiErr, setApiErr, onChange };
}

// ---- Modals ------------------------------------------------------------------------------

/** `unended`: the semester not ended yet, if any - the next registration can't open until it is. */
function StartRegistrationModal({ unended, onClose }: { unended: Registration | null; onClose: () => void }) {
  const { form, errors, setErrors, apiErr, setApiErr, onChange } = useForm({
    semester: "SPRING" as string,
    startDate: "",
    endDate: "",
    semesterStart: "",
    semesterEnd: "",
  });
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const semester = form.semester as Semester;

  async function endSemester() {
    if (!unended) return;
    setEnding(true);
    setApiErr("");
    const result = await universityAction("post", `/registrations/${unended.id}/end-semester`);
    setEnding(false);
    if (result.status === "success") await runAction(Promise.resolve(result));
    else setApiErr(result.message || "Failed to end the semester.");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateSemesterPeriod(form);
    if (!form.semester) errs.semester = "Semester is required";
    if (!form.startDate) errs.startDate = "Start date is required";
    if (!form.endDate) errs.endDate = "End date is required";
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      errs.endDate = "End date must be after the start date";
    }
    if (Object.values(errs).some(Boolean)) return setErrors(errs);
    setSaving(true);
    setApiErr("");
    const result = await universityAction("post", "/registrations", form);
    setSaving(false);
    if (result.status !== "success") return setApiErr(result.message || "Failed to start registration.");
    await runAction(Promise.resolve(result));
    onClose();
  }

  return (
    <ClassicModal open onClose={onClose} title="Start Registration">
      {unended ? (
        <Alert>
          <p>
            The {name(unended)} semester has not ended yet. End it before opening registration for the next semester. Its
            registration will be closed too.
          </p>
          <ClassicButton variant="danger" size="sm" onClick={endSemester} disabled={ending}>
            <CircleStop className="size-[13px]" /> {ending ? "Ending…" : `End ${name(unended)} Semester`}
          </ClassicButton>
        </Alert>
      ) : null}
      {apiErr ? <Alert>{apiErr}</Alert> : null}

      <form onSubmit={submit} noValidate>
        <FormGroup>
          <FormLabel htmlFor="semester" required>
            Semester
          </FormLabel>
          <Select id="semester" name="semester" value={form.semester} onChange={onChange} className={cn(errors.semester && inputErrorClass)}>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                {SEMESTER_LABELS[s]}
              </option>
            ))}
          </Select>
          <FieldError>{errors.semester}</FieldError>
          <FieldHint>
            This will open registration for {SEMESTER_LABELS[semester]} {computeRegistrationYear(semester)}.
          </FieldHint>
        </FormGroup>

        <FormRow>
          <DateField label="Start Date" name="startDate" value={form.startDate} error={errors.startDate} onChange={onChange} />
          <DateField label="End Date" name="endDate" value={form.endDate} error={errors.endDate} onChange={onChange} />
        </FormRow>
        <FieldHint className="-mt-2 mb-4">The registration window, when students can enroll in courses.</FieldHint>

        <SemesterPeriodFields form={form} errors={errors} onChange={onChange} />
        <FieldHint className="-mt-2 mb-4">
          When the semester itself runs. While today falls in it, this is the current semester for every batch.
        </FieldHint>

        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={saving || Boolean(unended)}>
            {saving ? "Starting…" : "Start Registration"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}

function SemesterPeriodModal({ registration, onClose }: { registration: Registration; onClose: () => void }) {
  const { form, errors, setErrors, apiErr, setApiErr, onChange } = useForm({
    semesterStart: toInputDate(registration.semesterStart),
    semesterEnd: toInputDate(registration.semesterEnd),
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateSemesterPeriod(form);
    if (Object.values(errs).some(Boolean)) return setErrors(errs);
    setSaving(true);
    setApiErr("");
    const result = await universityAction("put", `/registrations/${registration.id}/period`, form);
    setSaving(false);
    if (result.status !== "success") return setApiErr(result.message || "Failed to save the semester period.");
    await runAction(Promise.resolve(result));
    onClose();
  }

  return (
    <ClassicModal open onClose={onClose} title={`Semester Period — ${name(registration)}`}>
      <FieldHint className="mb-4 mt-0">
        While today falls in this period, {name(registration)} is the current semester for every batch.
      </FieldHint>
      {apiErr ? <Alert>{apiErr}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <SemesterPeriodFields form={form} errors={errors} onChange={onChange} />
        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}

function BatchLimitsModal({ registration, onClose }: { registration: Registration; onClose: () => void }) {
  const batches = useBatches().data?.batches ?? [];
  const [batch, setBatch] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const limits = [...registration.limits].sort((a, b) => a.batch.localeCompare(b.batch));

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!batch.trim() || !creditLimit) return;
    setSaving(true);
    setApiErr("");
    const result = await universityAction("put", `/registrations/${registration.id}/limits`, {
      batch: batch.trim(),
      creditLimit: Number(creditLimit),
    });
    setSaving(false);
    if (result.status !== "success") return setApiErr(result.message || "Failed to save credit limit.");
    setBatch("");
    setCreditLimit("");
  }

  async function remove(limitBatch: string) {
    const result = await universityAction("delete", `/registrations/${registration.id}/limits/${encodeURIComponent(limitBatch)}`);
    if (result.status !== "success") setApiErr(result.message || "Failed to remove credit limit.");
  }

  return (
    <ClassicModal open onClose={onClose} title={`Credit Limits — ${name(registration)}`}>
      <FieldHint className="mb-4 mt-0">
        Batches without an override use the default limit of {DEFAULT_CREDIT_LIMIT} credit hours.
      </FieldHint>
      {apiErr ? <Alert>{apiErr}</Alert> : null}

      {limits.length > 0 ? (
        <div className="mb-5 flex flex-col gap-2">
          {limits.map((l) => (
            <div key={l.batch} className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
              <span className="text-[0.85rem] font-semibold">Batch {l.batch}</span>
              <div className="flex items-center gap-3">
                <span className="text-[0.85rem] text-mid-foreground">{l.creditLimit} CR</span>
                <button
                  type="button"
                  onClick={() => remove(l.batch)}
                  aria-label={`Remove limit for batch ${l.batch}`}
                  className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-card text-destructive transition-colors hover:border-destructive-border hover:bg-destructive-soft"
                >
                  <X className="size-[13px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={add} className="flex items-end gap-[0.6rem]">
        <FormGroup className="mb-0 flex-1">
          <FormLabel htmlFor="limit-batch">Batch</FormLabel>
          <Select id="limit-batch" value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">Select…</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup className="mb-0 w-[110px]">
          <FormLabel htmlFor="limit-credits">Credit Limit</FormLabel>
          <Input
            id="limit-credits"
            type="number"
            min={1}
            max={100}
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="40"
          />
        </FormGroup>
        <ClassicButton type="submit" disabled={saving} className="shrink-0">
          {saving ? "Saving…" : "Set"}
        </ClassicButton>
      </form>

      <ModalActions>
        <ClassicButton variant="outline" onClick={onClose}>
          Close
        </ClassicButton>
      </ModalActions>
    </ClassicModal>
  );
}

// ---- Page --------------------------------------------------------------------------------

type ConfirmKind = "end" | "endSemester" | "delete";

const CONFIRMS: Record<ConfirmKind, { title: string; label: string; message: (r: Registration) => string; action: (r: Registration) => ["post" | "delete", string] }> = {
  end: {
    title: "End Registration",
    label: "End Registration",
    message: (r) =>
      `End registration for ${name(r)} now? Students won't be able to enroll in or change courses for this semester. This cannot be undone.`,
    action: (r) => ["post", `/registrations/${r.id}/end`],
  },
  endSemester: {
    title: "End Semester",
    label: "End Semester",
    message: (r) =>
      `End the ${name(r)} semester now? Its registration will be closed and registration for the next semester can be opened. This cannot be undone.`,
    action: (r) => ["post", `/registrations/${r.id}/end-semester`],
  },
  delete: { title: "Delete Registration", label: "Delete", message: deleteMessage, action: (r) => ["delete", `/registrations/${r.id}`] },
};

function RegistrationActions({
  registration: r,
  onLimits,
  onPeriod,
  onConfirm,
}: {
  registration: Registration;
  onLimits: (r: Registration) => void;
  onPeriod: (r: Registration) => void;
  onConfirm: (kind: ConfirmKind, r: Registration) => void;
}) {
  return (
    <ActionMenu label={`Actions for ${name(r)}`}>
      <ActionMenuItem onSelect={() => onLimits(r)}>
        <Settings2 /> Credit Limits
      </ActionMenuItem>
      <ActionMenuItem onSelect={() => onPeriod(r)}>
        <CalendarRange /> Semester Period
      </ActionMenuItem>
      {r.status === "ACTIVE" || !r.semesterEndedAt ? <ActionMenuDivider /> : null}
      {r.status === "ACTIVE" ? (
        <ActionMenuItem danger onSelect={() => onConfirm("end", r)}>
          <CircleStop /> End Registration
        </ActionMenuItem>
      ) : null}
      {!r.semesterEndedAt ? (
        <ActionMenuItem danger onSelect={() => onConfirm("endSemester", r)}>
          <CircleStop /> End Semester
        </ActionMenuItem>
      ) : null}
      <ActionMenuDivider />
      <ActionMenuItem danger onSelect={() => onConfirm("delete", r)}>
        <Trash2 /> Delete
      </ActionMenuItem>
    </ActionMenu>
  );
}

export default function RegistrationsPage() {
  const query = useUniversityQuery<{ registrations: Registration[] }>("/registrations");
  // Registration keeps its own layout choice, opening in List by default.
  const [view, setView] = useViewMode("registration", "list");
  const [starting, setStarting] = useState(false);
  const [limitsFor, setLimitsFor] = useState<number | null>(null);
  const [periodFor, setPeriodFor] = useState<Registration | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; registration: Registration } | null>(null);
  const [pending, setPending] = useState(false);

  async function runConfirm() {
    if (!confirm) return;
    const [method, url] = CONFIRMS[confirm.kind].action(confirm.registration);
    setPending(true);
    await runAction(universityAction(method, url));
    setPending(false);
    setConfirm(null);
  }

  return (
    <PageContainer className="gap-5">
      <SectionHeader
        title="Registration"
        description="Open a registration window for students to enroll in a semester."
        breadcrumbs={[{ label: "Registration" }]}
        actions={
          <ClassicButton onClick={() => setStarting(true)} className="shrink-0">
            <Plus className="size-4" /> Start Registration
          </ClassicButton>
        }
      />
      <ViewToggle view={view} onChange={setView} />

      <QueryView query={query} loading={<ListSkeleton rows={4} />}>
        {({ registrations }) => {
          // Newest first, so this is the semester the server checks before opening the next one.
          const unended = registrations.find((r) => !r.semesterEndedAt) ?? null;
          // Read the live row, so the limits modal reflects each change.
          const limitsRegistration = registrations.find((r) => r.id === limitsFor) ?? null;
          const handlers = {
            onLimits: (r: Registration) => setLimitsFor(r.id),
            onPeriod: setPeriodFor,
            onConfirm: (kind: ConfirmKind, registration: Registration) => setConfirm({ kind, registration }),
          };
          return (
            <>
              {registrations.length === 0 ? (
                <TableEmpty icon={CalendarClock}>No registrations yet. Start one to open enrollment for a semester.</TableEmpty>
              ) : view === "list" ? (
                <TableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Semester</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registration</TableHead>
                        <TableHead>Semester Period</TableHead>
                        <TableHead>Credit Limits</TableHead>
                        <TableHead className="w-0 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrations.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap font-semibold">{name(r)}</TableCell>
                          <TableCell>
                            <StatusPill tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</StatusPill>
                          </TableCell>
                          <TableCell>
                            <div className="whitespace-nowrap">
                              {formatDate(r.startDate)} – {formatDate(r.endDate)}
                            </div>
                            {r.closedAt ? (
                              <div className="whitespace-nowrap text-[0.8rem] text-muted-foreground">Ended {formatDate(r.closedAt)}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="whitespace-nowrap">{periodText(r)}</div>
                            {r.semesterEndedAt ? (
                              <div className="whitespace-nowrap text-[0.8rem] text-muted-foreground">
                                Ended {formatDate(r.semesterEndedAt)}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="min-w-40 whitespace-normal text-[0.8rem] text-muted-foreground">{limitsText(r)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <RegistrationActions registration={r} {...handlers} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableCard>
              ) : (
                <CardGrid>
                  {registrations.map((r) => (
                    <DetailCard key={r.id}>
                      <div className="mb-3 flex items-center justify-between gap-[0.6rem]">
                        <span className="text-[0.8rem] font-bold text-foreground">{name(r)}</span>
                        <StatusPill tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</StatusPill>
                      </div>
                      <div className="flex flex-col gap-[0.2rem] text-[0.82rem] text-muted-foreground">
                        <p>
                          Registration: {formatDate(r.startDate)} – {formatDate(r.endDate)}
                          {r.closedAt ? ` (ended ${formatDate(r.closedAt)})` : ""}
                        </p>
                        <p>
                          Semester: {periodText(r)}
                          {r.semesterEndedAt ? ` (ended ${formatDate(r.semesterEndedAt)})` : ""}
                        </p>
                        <p>{limitsText(r)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <RegistrationActions registration={r} {...handlers} />
                      </div>
                    </DetailCard>
                  ))}
                </CardGrid>
              )}

              {starting ? <StartRegistrationModal unended={unended} onClose={() => setStarting(false)} /> : null}
              {periodFor ? <SemesterPeriodModal registration={periodFor} onClose={() => setPeriodFor(null)} /> : null}
              {limitsRegistration ? <BatchLimitsModal registration={limitsRegistration} onClose={() => setLimitsFor(null)} /> : null}
            </>
          );
        }}
      </QueryView>

      <ClassicConfirm
        open={confirm !== null}
        title={confirm ? CONFIRMS[confirm.kind].title : undefined}
        message={confirm ? CONFIRMS[confirm.kind].message(confirm.registration) : ""}
        confirmLabel={confirm ? CONFIRMS[confirm.kind].label : undefined}
        pending={pending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </PageContainer>
  );
}
