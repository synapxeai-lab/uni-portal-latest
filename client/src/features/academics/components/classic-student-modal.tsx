import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Alert,
  ClassicButton,
  ClassicModal,
  FieldError,
  FieldHint,
  FormLabel,
  inputErrorClass,
  ModalActions,
} from "@/components/classic/classic";
import { cn } from "@/lib/utils";

import { universityAction, useBatches, useDepartments, useProgrammeCategories } from "../api";
import type { CreatedLogin, StudentRecord } from "./people-dialogs";

/**
 * Add / Edit Student: an exact replica of the old University Portal's
 * StudentModal - a wide form in four sections (Personal, Academic, Previous
 * Education, Guardian) with inline validation, CNIC auto-dashes and a section
 * picker limited to the sections the programme has in the chosen batch.
 */

const FIELDS = [
  "name", "rollNo", "email", "programme", "batch", "section", "cnic", "phone", "address", "dob", "gender",
  "lastQualification", "passingYear", "grade", "university",
  "guardianName", "guardianContact", "guardianCnic", "guardianRelationship", "guardianEmail",
] as const;
type Field = (typeof FIELDS)[number];
type Form = Record<Field, string>;

const GENDERS = [
  ["MALE", "Male"],
  ["FEMALE", "Female"],
  ["OTHER", "Other"],
] as const;
const GUARDIAN_RELATIONSHIPS = ["Father", "Mother", "Brother", "Sister", "Uncle", "Aunt", "Grandparent", "Spouse", "Other"];
// Keep a value that isn't one of the options (e.g. set through the API) selectable.
const withCurrent = (options: string[], value: string) => (value && !options.includes(value) ? [value, ...options] : options);

const CNIC_FIELDS: Field[] = ["cnic", "guardianCnic"];
/** Inserts the dashes as digits are typed: 6110112345671 -> 61101-1234567-1. */
const formatCnic = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  return [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12)].filter(Boolean).join("-");
};
const CNIC_RE = /^\d{5}-\d{7}-\d$/;
const EMAIL_RE = /\S+@\S+\.\S+/;

function toForm(student: StudentRecord | undefined, defaultProgramme: string): Form {
  const empty = Object.fromEntries(FIELDS.map((f) => [f, ""])) as Form;
  if (!student) return { ...empty, programme: defaultProgramme };
  return {
    ...empty,
    ...Object.fromEntries(FIELDS.map((f) => [f, student[f as keyof StudentRecord] == null ? "" : String(student[f as keyof StudentRecord])])),
    // Students added before these fields existed have them empty.
    dob: student.dob ? student.dob.toISOString().slice(0, 10) : "",
  } as Form;
}

function validate(form: Form, today: string, maxPassingYear: number) {
  const e: Partial<Record<Field, string>> = {};
  if (!form.name.trim()) e.name = "Student name is required";
  if (!form.rollNo.trim()) e.rollNo = "Roll number is required";
  if (!form.email.trim()) e.email = "Email is required";
  else if (!EMAIL_RE.test(form.email)) e.email = "Invalid email address";
  if (!form.batch) e.batch = "Batch is required";
  if (!form.section.trim()) e.section = "Section is required";
  if (!CNIC_RE.test(form.cnic.trim())) e.cnic = "CNIC must be in format 12345-1234567-1";
  if (!form.phone.trim()) e.phone = "Phone number is required";
  if (!form.address.trim()) e.address = "Address is required";
  if (!form.dob) e.dob = "Date of birth is required";
  else if (form.dob >= today) e.dob = "Enter a valid date of birth";
  if (!form.gender) e.gender = "Gender is required";
  if (!form.lastQualification.trim()) e.lastQualification = "Last qualification is required";
  const year = Number(form.passingYear);
  if (!form.passingYear.trim()) e.passingYear = "Passing year is required";
  else if (!Number.isInteger(year) || year < 1950 || year > maxPassingYear) e.passingYear = "Enter a valid passing year";
  if (!form.grade.trim()) e.grade = "Grade is required";
  if (!form.university.trim()) e.university = "Board / university is required";
  if (!form.guardianName.trim()) e.guardianName = "Guardian name is required";
  if (!form.guardianRelationship) e.guardianRelationship = "Guardian relationship is required";
  if (!form.guardianContact.trim()) e.guardianContact = "Guardian contact is required";
  if (!form.guardianEmail.trim()) e.guardianEmail = "Guardian email is required";
  else if (!EMAIL_RE.test(form.guardianEmail)) e.guardianEmail = "Invalid email address";
  if (!CNIC_RE.test(form.guardianCnic.trim())) e.guardianCnic = "Guardian CNIC must be in format 12345-1234567-1";
  return e;
}

/** .form-section-title: a full-width uppercase heading with a rule under it. */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="col-span-full mb-[0.85rem] mt-3 border-b border-border pb-[0.4rem] text-[0.8rem] font-extrabold uppercase tracking-[0.06em] text-mid-foreground first:mt-0">
      {children}
    </h3>
  );
}

export function ClassicStudentModal({
  student,
  onClose,
  onLoginCreated,
}: {
  student?: StudentRecord;
  onClose: () => void;
  onLoginCreated?: (login: CreatedLogin) => void;
}) {
  const categories = useProgrammeCategories().data?.categories ?? [];
  const batches = useBatches().data?.batches ?? [];
  const departments = useDepartments().data?.departments ?? [];
  const isEdit = Boolean(student);
  const [form, setForm] = useState<Form>(() => toForm(student, categories[0]?.key ?? ""));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [loading, setLoading] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const maxPassingYear = new Date().getFullYear() + 1;
  // Categories may arrive after the modal opened: default a new student's programme then.
  const programme = form.programme || (isEdit ? "" : (categories[0]?.key ?? ""));

  // Section letters the batch has in any of the programme's diplomas, e.g. ["A", "B"]:
  // a student moves through every diploma with the same letter.
  const sectionsFor = (prog: string, batch: string) =>
    [
      ...new Set(
        departments
          .filter((d) => d.category === prog)
          .flatMap((d) => d.sections.filter((s) => s.batch === batch).map((s) => s.label)),
      ),
    ].sort((a, b) => a.localeCompare(b));
  const sectionOptions = sectionsFor(programme, form.batch);
  // Keep a student's current section listed even if it no longer exists.
  if (form.section && !sectionOptions.includes(form.section)) sectionOptions.unshift(form.section);
  const batchOptions = form.batch && !batches.includes(form.batch) ? [form.batch, ...batches] : batches;

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as Field;
    const value = CNIC_FIELDS.includes(name) ? formatCnic(e.target.value) : e.target.value;
    setForm((prev) => {
      const next = { ...prev, programme: prev.programme || programme, [name]: value };
      // A new programme or batch has its own sections: clear a section that isn't one of them.
      if ((name === "programme" || name === "batch") && !sectionsFor(next.programme, next.batch).includes(prev.section)) {
        next.section = "";
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setApiErr("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const filled = { ...form, programme };
    const errs = validate(filled, today, maxPassingYear);
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    setApiErr("");
    const payload = Object.fromEntries(Object.entries(filled).map(([k, v]) => [k, v.trim()]));
    const result = student
      ? await universityAction<{ student: StudentRecord }>("put", `/students/${student.id}`, payload)
      : await universityAction<{ student: StudentRecord; login?: CreatedLogin | null }>("post", "/students", payload);
    setLoading(false);
    if (result.status !== "success") return setApiErr(result.message || "Something went wrong. Please try again.");
    const login = (result.data as { login?: CreatedLogin | null }).login;
    if (login) onLoginCreated?.(login);
    else toast.success(`Student ${filled.name.trim()} ${isEdit ? "updated" : "added"} successfully.`);
    onClose();
  }

  const text = (name: Field, label: string, placeholder?: string, extra?: Partial<React.ComponentProps<"input">>) => (
    <div className="mb-[1.1rem]">
      <FormLabel htmlFor={`student-${name}`} required>
        {label}
      </FormLabel>
      <Input
        id={`student-${name}`}
        name={name}
        type="text"
        value={form[name]}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(errors[name] && inputErrorClass)}
        {...extra}
      />
      <FieldError>{errors[name]}</FieldError>
    </div>
  );

  const select = (name: Field, label: string, options: [string, string][], placeholder: string, extra?: ReactNode, disabled?: boolean) => (
    <div className="mb-[1.1rem]">
      <FormLabel htmlFor={`student-${name}`} required>
        {label}
      </FormLabel>
      <Select
        id={`student-${name}`}
        name={name}
        value={name === "programme" ? programme : form[name]}
        onChange={onChange}
        disabled={disabled}
        className={cn(errors[name] && inputErrorClass)}
      >
        <option value="">{placeholder}</option>
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </Select>
      {extra}
      <FieldError>{errors[name]}</FieldError>
    </div>
  );

  return (
    <ClassicModal open onClose={onClose} title={isEdit ? "Edit Student" : "Add Student"} width={980} centered>
      {apiErr ? <Alert>{apiErr}</Alert> : null}
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-x-4 overflow-y-auto overscroll-contain pb-0 pl-[2px] pr-2 pt-[2px] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          <SectionTitle>Personal Details</SectionTitle>
          {text("name", "Student Name", "e.g. Ahmed Raza")}
          {text("email", "Student Email", "student@example.com", { type: "email" })}
          {text("phone", "Phone No", "e.g. 0300-1234567")}
          {text("cnic", "CNIC", "e.g. 61101-1234567-1", { inputMode: "numeric", maxLength: 15 })}
          {text("dob", "Date of Birth", undefined, { type: "date", max: today })}
          {select("gender", "Gender", GENDERS.map(([k, l]) => [k, l]), "Select gender…")}
          <div className="col-span-full">{text("address", "Address", "e.g. House 12, Street 4, F-8, Islamabad")}</div>

          <SectionTitle>Academic Details</SectionTitle>
          {text("rollNo", "Roll No", "e.g. CS-2021-045")}
          {select(
            "programme",
            "Programme",
            categories.map((c) => [c.key, c.label]),
            "Select a programme…",
          )}
          {select("batch", "Batch", batchOptions.map((b) => [b, b]), "Select a batch…")}
          {select(
            "section",
            "Section",
            sectionOptions.map((label) => [label, `Section ${label}`]),
            form.batch ? "Select a section…" : "Select a batch first",
            form.batch && sectionOptions.length === 0 ? (
              <FieldHint>This programme has no sections in Batch {form.batch} yet. Add one from the Batches page.</FieldHint>
            ) : null,
            !form.batch || sectionOptions.length === 0,
          )}

          <SectionTitle>Previous Education</SectionTitle>
          {text("lastQualification", "Last Qualification", "e.g. Intermediate (FSc)")}
          {text("passingYear", "Passing Year", `e.g. ${maxPassingYear - 1}`, {
            type: "number",
            inputMode: "numeric",
            min: 1950,
            max: maxPassingYear,
          })}
          {text("grade", "Grade", "e.g. A or 85%")}
          {text("university", "Board / University", "e.g. FBISE Islamabad")}

          <SectionTitle>Guardian Details</SectionTitle>
          {text("guardianName", "Guardian Name", "e.g. Muhammad Khan")}
          {select(
            "guardianRelationship",
            "Guardian Relationship",
            withCurrent(GUARDIAN_RELATIONSHIPS, form.guardianRelationship).map((r) => [r, r]),
            "Select relationship…",
          )}
          {text("guardianContact", "Guardian Phone No", "e.g. 0301-1234567")}
          {text("guardianEmail", "Guardian Email", "guardian@example.com", { type: "email" })}
          {text("guardianCnic", "Guardian CNIC", "e.g. 61101-7654321-1", { inputMode: "numeric", maxLength: 15 })}
        </div>

        <ModalActions className="shrink-0">
          <ClassicButton variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Student"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}
