import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

import { universityAction } from "../api";
import type { ProgrammeCategory } from "../types";
import { FormDialog, type FormField } from "./form-dialog";

export interface TeacherRecord {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  cnic: string;
  qualification: string;
  programme: string;
  type: "PERMANENT" | "VISITING";
  salary: number | null;
  ratePerCreditHour: number | null;
  guardianName: string;
  guardianContact: string;
  guardianCnic: string;
  userId: string | null;
  user: { id: string; status: string } | null;
  sectionCourses: {
    id: number;
    course: { id: number; code: string; name: string; creditHours: number };
    section: { id: number; label: string; batch: string };
  }[];
}

export interface StudentRecord {
  id: number;
  name: string;
  rollNo: string;
  email: string;
  phone: string;
  address: string;
  cnic: string;
  dob: Date | null;
  gender: string | null;
  lastQualification: string | null;
  passingYear: number | null;
  grade: string | null;
  university: string | null;
  programme: string;
  batch: string;
  section: string;
  guardianName: string;
  guardianContact: string;
  guardianCnic: string;
  guardianRelationship: string | null;
  guardianEmail: string | null;
  userId: string | null;
  user: { id: string; status: string } | null;
  currentDiploma: { id: number; name: string; code: string; semester: number; color: string; bg: string } | null;
}

export interface CreatedLogin {
  email: string;
  password: string;
}

const CNIC_HINT = "Format 12345-1234567-1";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ProgrammeCategory[];
  /** Called with the new login when one was created. */
  onLoginCreated?: (login: CreatedLogin) => void;
}

const programmeField = (categories: ProgrammeCategory[]): FormField => ({
  name: "programme",
  label: "Programme",
  type: "select",
  required: true,
  options: categories.map((c) => ({ value: c.key, label: c.label })),
});

export function TeacherDialog({ teacher, categories, onLoginCreated, ...props }: DialogProps & { teacher?: TeacherRecord }) {
  return (
    <FormDialog
      {...props}
      wide
      title={teacher ? "Edit teacher" : "Add teacher"}
      description={teacher ? undefined : "A login is created for the teacher; you'll see its password once saved."}
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone", required: true },
        { name: "cnic", label: "CNIC", required: true, hint: CNIC_HINT },
        { name: "qualification", label: "Qualification", required: true },
        programmeField(categories),
        {
          name: "type",
          label: "Type",
          type: "select",
          required: true,
          options: [
            { value: "PERMANENT", label: "Permanent (monthly salary)" },
            { value: "VISITING", label: "Visiting (paid per credit hour)" },
          ],
        },
        {
          name: "salary",
          label: "Salary (Rs.)",
          type: "number",
          nullable: true,
          min: 0,
          hidden: (v) => v.type !== "PERMANENT",
        },
        {
          name: "ratePerCreditHour",
          label: "Rate per credit hour (Rs.)",
          type: "number",
          nullable: true,
          min: 0,
          hidden: (v) => v.type !== "VISITING",
        },
        { name: "address", label: "Address", required: true, wide: true },
        { name: "guardianName", label: "Guardian name", required: true },
        { name: "guardianContact", label: "Guardian contact", required: true },
        { name: "guardianCnic", label: "Guardian CNIC", required: true, hint: CNIC_HINT },
      ]}
      initialValues={teacher ?? { type: "PERMANENT" }}
      submitLabel={teacher ? "Save" : "Add teacher"}
      onSubmit={(values) =>
        teacher
          ? universityAction("put", `/teachers/${teacher.id}`, values)
          : universityAction("post", "/teachers", values)
      }
      onSaved={(data) => {
        const login = (data as { login?: CreatedLogin | null }).login;
        if (login) onLoginCreated?.(login);
      }}
    />
  );
}

export function StudentDialog({
  student,
  categories,
  batches,
  onLoginCreated,
  ...props
}: DialogProps & { student?: StudentRecord; batches: string[] }) {
  return (
    <FormDialog
      {...props}
      wide
      title={student ? "Edit student" : "Add student"}
      description={student ? undefined : "A login is created for the student; you'll see its password once saved."}
      fields={[
        { name: "name", label: "Full name", required: true },
        { name: "rollNo", label: "Roll number", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone", required: true },
        { name: "cnic", label: "CNIC / B-Form", required: true, hint: CNIC_HINT },
        { name: "dob", label: "Date of birth", type: "date", required: true },
        {
          name: "gender",
          label: "Gender",
          type: "select",
          required: true,
          options: [
            { value: "MALE", label: "Male" },
            { value: "FEMALE", label: "Female" },
            { value: "OTHER", label: "Other" },
          ],
        },
        programmeField(categories),
        {
          name: "batch",
          label: "Batch",
          type: "select",
          required: true,
          options: batches.map((b) => ({ value: b, label: b })),
        },
        { name: "section", label: "Section", required: true, placeholder: "A" },
        { name: "lastQualification", label: "Last qualification", required: true },
        { name: "passingYear", label: "Passing year", type: "number", required: true, min: 1950 },
        { name: "grade", label: "Grade / division", required: true },
        { name: "university", label: "Board / university", required: true },
        { name: "address", label: "Address", required: true, wide: true },
        { name: "guardianName", label: "Guardian name", required: true },
        { name: "guardianRelationship", label: "Relationship", required: true },
        { name: "guardianContact", label: "Guardian contact", required: true },
        { name: "guardianCnic", label: "Guardian CNIC", required: true, hint: CNIC_HINT },
        { name: "guardianEmail", label: "Guardian email", type: "email", required: true, wide: true },
      ]}
      initialValues={
        student
          ? { ...student, dob: student.dob ? student.dob.toISOString().slice(0, 10) : "" }
          : { section: "A", batch: batches[0] ?? "" }
      }
      submitLabel={student ? "Save" : "Add student"}
      onSubmit={(values) =>
        student
          ? universityAction("put", `/students/${student.id}`, values)
          : universityAction("post", "/students", values)
      }
      onSaved={(data) => {
        const login = (data as { login?: CreatedLogin | null }).login;
        if (login) onLoginCreated?.(login);
      }}
    />
  );
}

/** Shows the credentials of a login that was just created for a teacher or student. */
export function LoginCreatedDialog({ login, onClose }: { login: CreatedLogin | null; onClose: () => void }) {
  const { copy, copied } = useCopyToClipboard();
  return (
    <Dialog open={login !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Login created</DialogTitle>
          <DialogDescription>
            Share these sign-in details. You can look the password up again on the Users page.
          </DialogDescription>
        </DialogHeader>
        {login ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-3 font-mono text-sm">
            <span className="break-all">{login.email}</span>
            <div className="flex items-center justify-between gap-2">
              <span className="select-all">{login.password}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Copy password"
                onClick={() => copy(login.password, "Password copied")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
