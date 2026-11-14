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

import { universityAction, useProgrammeCategories } from "../api";
import type { CreatedLogin, TeacherRecord } from "./people-dialogs";

/**
 * Add / Edit Teacher: an exact replica of the old University Portal's
 * TeacherModal - Personal, Professional and Guardian sections, with the pay
 * field following the teacher type (salary or rate per credit hour).
 */

export const TEACHER_TYPES = [
  { key: "PERMANENT", label: "Permanent", color: "#166534", bg: "#dcfce7" },
  { key: "VISITING", label: "Visiting", color: "#6b21a8", bg: "#f3e8ff" },
] as const;
export const teacherTypeByKey = (key: string) => TEACHER_TYPES.find((t) => t.key === key) ?? TEACHER_TYPES[0];

const formatPKR = (n: number) => `Rs. ${(Number(n) || 0).toLocaleString("en-PK")}`;
/** "Rs. 80,000 salary" / "Rs. 2,000 per credit hour", or null when not set. */
export function payRateText(t: Pick<TeacherRecord, "type" | "salary" | "ratePerCreditHour">) {
  if (t.type === "VISITING") return t.ratePerCreditHour == null ? null : `${formatPKR(t.ratePerCreditHour)} per credit hour`;
  return t.salary == null ? null : `${formatPKR(t.salary)} salary`;
}

const FIELDS = [
  "name", "phone", "email", "address", "cnic", "qualification", "programme",
  "type", "salary", "ratePerCreditHour", "guardianName", "guardianContact", "guardianCnic",
] as const;
type Field = (typeof FIELDS)[number];
type Form = Record<Field, string>;

const CNIC_FIELDS: Field[] = ["cnic", "guardianCnic"];
const formatCnic = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  return [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12)].filter(Boolean).join("-");
};
const CNIC_RE = /^\d{5}-\d{7}-\d$/;

function toForm(t: TeacherRecord | undefined, defaultProgramme: string): Form {
  if (!t) {
    return {
      ...(Object.fromEntries(FIELDS.map((f) => [f, ""])) as Form),
      type: "PERMANENT",
      programme: defaultProgramme,
    };
  }
  return {
    name: t.name,
    phone: t.phone,
    email: t.email,
    address: t.address,
    cnic: t.cnic,
    qualification: t.qualification,
    programme: t.programme,
    type: t.type ?? "PERMANENT",
    salary: t.salary == null ? "" : String(t.salary),
    ratePerCreditHour: t.ratePerCreditHour == null ? "" : String(t.ratePerCreditHour),
    guardianName: t.guardianName,
    guardianContact: t.guardianContact,
    guardianCnic: t.guardianCnic,
  };
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="col-span-full mb-[0.85rem] mt-3 border-b border-border pb-[0.4rem] text-[0.8rem] font-extrabold uppercase tracking-[0.06em] text-mid-foreground first:mt-0">
      {children}
    </h3>
  );
}

export function ClassicTeacherModal({
  teacher,
  onClose,
  onLoginCreated,
}: {
  teacher?: TeacherRecord;
  onClose: () => void;
  onLoginCreated?: (login: CreatedLogin) => void;
}) {
  const categories = useProgrammeCategories().data?.categories ?? [];
  const isEdit = Boolean(teacher);
  const [form, setForm] = useState<Form>(() => toForm(teacher, categories[0]?.key ?? ""));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [loading, setLoading] = useState(false);
  const [apiErr, setApiErr] = useState("");
  // Categories may arrive after the modal opened: default a new teacher's programme then.
  const programme = form.programme || (isEdit ? "" : (categories[0]?.key ?? ""));
  const visiting = form.type === "VISITING";

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as Field;
    const value = CNIC_FIELDS.includes(name) ? formatCnic(e.target.value) : e.target.value;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
    setApiErr("");
  };

  function validate(f: Form) {
    const e: Partial<Record<Field, string>> = {};
    if (!f.name.trim()) e.name = "Teacher name is required";
    if (!f.phone.trim()) e.phone = "Phone number is required";
    if (!f.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(f.email)) e.email = "Invalid email address";
    if (!f.address.trim()) e.address = "Address is required";
    if (!CNIC_RE.test(f.cnic.trim())) e.cnic = "CNIC must be in format 12345-1234567-1";
    if (!f.qualification.trim()) e.qualification = "Qualification is required";
    if (!f.programme) e.programme = "Programme is required";
    const payField: Field = f.type === "VISITING" ? "ratePerCreditHour" : "salary";
    const amount = Number(f[payField]);
    if (f[payField].trim() === "" || !Number.isInteger(amount) || amount < 0) {
      e[payField] = f.type === "VISITING" ? "Enter the rate per credit hour in whole rupees" : "Enter the salary in whole rupees";
    }
    if (!f.guardianName.trim()) e.guardianName = "Guardian name is required";
    if (!f.guardianContact.trim()) e.guardianContact = "Guardian contact is required";
    if (!CNIC_RE.test(f.guardianCnic.trim())) e.guardianCnic = "Guardian CNIC must be in format 12345-1234567-1";
    return e;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const filled = { ...form, programme };
    const errs = validate(filled);
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    setApiErr("");
    const { salary, ratePerCreditHour, ...text } = filled;
    // Only the pay field for the chosen type is sent; the other keeps its old value.
    const payload = {
      ...Object.fromEntries(Object.entries(text).map(([k, v]) => [k, v.trim()])),
      ...(filled.type === "VISITING" ? { ratePerCreditHour: Number(ratePerCreditHour) } : { salary: Number(salary) }),
    };
    const result = teacher
      ? await universityAction("put", `/teachers/${teacher.id}`, payload)
      : await universityAction("post", "/teachers", payload);
    setLoading(false);
    if (result.status !== "success") return setApiErr(result.message || "Something went wrong. Please try again.");
    const login = (result.data as { login?: CreatedLogin | null } | undefined)?.login;
    if (login) onLoginCreated?.(login);
    else toast.success(`Teacher ${filled.name.trim()} ${isEdit ? "updated" : "added"} successfully.`);
    onClose();
  }

  const text = (name: Field, label: string, placeholder?: string, extra?: React.ComponentProps<"input">, hint?: ReactNode) => (
    <div className="mb-[1.1rem]">
      <FormLabel htmlFor={`teacher-${name}`} required>
        {label}
      </FormLabel>
      <Input
        id={`teacher-${name}`}
        name={name}
        type="text"
        value={form[name]}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(errors[name] && inputErrorClass)}
        {...extra}
      />
      {errors[name] ? <FieldError>{errors[name]}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );

  return (
    <ClassicModal open onClose={onClose} title={isEdit ? "Edit Teacher" : "Add Teacher"} width={980} centered>
      {apiErr ? <Alert>{apiErr}</Alert> : null}
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-x-4 overflow-y-auto overscroll-contain pl-[2px] pr-2 pt-[2px] max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          <SectionTitle>Personal Details</SectionTitle>
          {text("name", "Teacher Name", "e.g. Dr. Ayesha Khan")}
          {text("phone", "Teacher Phone Number", "e.g. 0300-1234567")}
          {text("email", "Teacher Email", "teacher@example.com", { type: "email" })}
          {text("cnic", "CNIC", "e.g. 61101-1234567-1", { inputMode: "numeric", maxLength: 15 })}
          <div className="col-span-full">{text("address", "Address", "e.g. House 12, Street 4, F-8, Islamabad")}</div>

          <SectionTitle>Professional Details</SectionTitle>
          {text("qualification", "Qualification", "e.g. PhD in Computer Science")}
          <div className="mb-[1.1rem]">
            <FormLabel htmlFor="teacher-programme" required>
              Programme
            </FormLabel>
            <Select
              id="teacher-programme"
              name="programme"
              value={programme}
              onChange={onChange}
              className={cn(errors.programme && inputErrorClass)}
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
            <FieldError>{errors.programme}</FieldError>
          </div>
          <div className="mb-[1.1rem]">
            <FormLabel htmlFor="teacher-type" required>
              Teacher Type
            </FormLabel>
            <Select id="teacher-type" name="type" value={form.type} onChange={onChange}>
              {TEACHER_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          {visiting
            ? text(
                "ratePerCreditHour",
                "Rate per Credit Hour (Rs.)",
                "e.g. 2500",
                { type: "number", min: 0, step: 1 },
                "Pay is this rate times the credit hours of the courses they teach.",
              )
            : text("salary", "Salary (Rs.)", "e.g. 80000", { type: "number", min: 0, step: 1 }, "Fixed salary, whatever courses they teach.")}

          <SectionTitle>Guardian Details</SectionTitle>
          {text("guardianName", "Guardian Name", "e.g. Muhammad Khan")}
          {text("guardianContact", "Guardian Contact", "e.g. 0301-1234567")}
          {text("guardianCnic", "Guardian CNIC", "e.g. 61101-7654321-1", { inputMode: "numeric", maxLength: 15 })}
        </div>

        <ModalActions className="shrink-0">
          <ClassicButton variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Teacher"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}
