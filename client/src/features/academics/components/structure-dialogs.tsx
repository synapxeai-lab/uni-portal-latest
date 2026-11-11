import { universityAction } from "../api";
import type { BatchDetail, Course, Department, ExtraFee, ProgrammeCategory } from "../types";
import { FormDialog, type FieldValue } from "./form-dialog";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (data: unknown) => void;
}

/** Diploma colour pairs (same as the server's programme colours). */
export const DIPLOMA_COLOURS = [
  { name: "Amber", color: "#b45309", bg: "#fef3c7" },
  { name: "Rose", color: "#be185d", bg: "#fce7f3" },
  { name: "Blue", color: "#1565c0", bg: "#e8f1fd" },
  { name: "Teal", color: "#0f766e", bg: "#ccfbf1" },
  { name: "Purple", color: "#6b21a8", bg: "#f3e8ff" },
  { name: "Red", color: "#b91c1c", bg: "#fef2f2" },
  { name: "Green", color: "#166534", bg: "#dcfce7" },
  { name: "Orange", color: "#92400e", bg: "#ffedd5" },
  { name: "Stone", color: "#44403c", bg: "#f5f5f4" },
];

export function ProgrammeDialog({ category, ...props }: DialogProps & { category?: ProgrammeCategory }) {
  return (
    <FormDialog
      {...props}
      title={category ? "Edit main programme" : "Add main programme"}
      description="A main programme groups diplomas, e.g. Culinary Programmes."
      fields={[
        { name: "label", label: "Name", required: true, placeholder: "e.g. Bakery Programmes" },
        { name: "description", label: "Description", type: "textarea", required: true },
      ]}
      initialValues={category}
      submitLabel={category ? "Save" : "Add programme"}
      onSubmit={(values) =>
        category
          ? universityAction("put", `/programme-categories/${category.id}`, values)
          : universityAction("post", "/programme-categories", values)
      }
    />
  );
}

export function DiplomaDialog({
  department,
  categories,
  defaultCategory,
  ...props
}: DialogProps & {
  department?: Department;
  categories: ProgrammeCategory[];
  defaultCategory?: string;
}) {
  const colourIndex = department
    ? Math.max(0, DIPLOMA_COLOURS.findIndex((c) => c.color === department.color))
    : 0;
  return (
    <FormDialog
      {...props}
      wide
      title={department ? "Edit diploma" : "Add diploma"}
      description="A diploma is one semester of its programme; students study it in that semester."
      fields={[
        { name: "name", label: "Name", required: true, wide: true },
        { name: "code", label: "Code", required: true, placeholder: "e.g. DCS" },
        {
          name: "category",
          label: "Main programme",
          type: "select",
          required: true,
          options: categories.map((c) => ({ value: c.key, label: c.label })),
        },
        {
          name: "semester",
          label: "Semester",
          type: "number",
          min: 1,
          max: 20,
          hint: department ? undefined : "Leave empty to make it the programme's next semester.",
        },
        { name: "head", label: "Head", required: true },
        { name: "discountRate", label: "Whole-diploma discount (%)", type: "number", min: 0, max: 100, step: 0.5 },
        {
          name: "colour",
          label: "Colour",
          type: "select",
          options: DIPLOMA_COLOURS.map((c, index) => ({ value: String(index), label: c.name })),
        },
        { name: "description", label: "Description", type: "textarea", required: true },
      ]}
      initialValues={{
        ...department,
        category: department?.category ?? defaultCategory ?? "",
        semester: department?.semester ?? "",
        discountRate: department?.discountRate ?? 0,
        colour: String(colourIndex),
      }}
      submitLabel={department ? "Save" : "Add diploma"}
      onSubmit={(values) => {
        const { colour, ...rest } = values;
        const pair = DIPLOMA_COLOURS[Number(colour) || 0];
        const body = { ...rest, color: pair.color, bg: pair.bg };
        return department
          ? universityAction("put", `/departments/${department.id}`, body)
          : universityAction("post", "/departments", body);
      }}
    />
  );
}

export function CourseDialog({
  course,
  departments,
  defaultDepartmentId,
  ...props
}: DialogProps & { course?: Course; departments: Department[]; defaultDepartmentId?: number }) {
  const departmentOptions = departments.map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` }));
  return (
    <FormDialog
      {...props}
      wide
      title={course ? "Edit course" : "Add course"}
      description={
        course
          ? undefined
          : "Pick every diploma that teaches this course; each gets its own copy with the same code."
      }
      fields={[
        { name: "name", label: "Course name", required: true, wide: true },
        { name: "code", label: "Code", required: true },
        { name: "creditHours", label: "Credit hours", type: "number", required: true, min: 1, max: 100 },
        { name: "fee", label: "Fee (Rs.)", type: "number", min: 0 },
        { name: "discountRate", label: "Discount (%)", type: "number", min: 0, max: 100, step: 0.5 },
        course
          ? {
              name: "departmentId",
              label: "Diploma",
              type: "select",
              required: true,
              wide: true,
              options: departmentOptions,
              hint: "Moving a course to another diploma removes it from its current sections.",
            }
          : {
              name: "departmentIds",
              label: "Diplomas",
              type: "checkboxes",
              required: true,
              wide: true,
              options: departmentOptions,
            },
      ]}
      initialValues={
        course
          ? course
          : { departmentIds: defaultDepartmentId ? [defaultDepartmentId] : [], fee: 0, discountRate: 0 }
      }
      submitLabel={course ? "Save" : "Add course"}
      onSubmit={(values) =>
        course
          ? universityAction("put", `/courses/${course.id}`, values)
          : universityAction("post", "/courses", values)
      }
    />
  );
}

export function CopyCourseDialog({
  course,
  departments,
  ...props
}: DialogProps & { course: Course; departments: Department[] }) {
  return (
    <FormDialog
      {...props}
      title={`Add ${course.code} to another diploma`}
      description="The copy keeps the code, credit hours, fees and assessment scheme."
      fields={[
        {
          name: "departmentId",
          label: "Diploma",
          type: "select",
          required: true,
          options: departments
            .filter((d) => d.id !== course.departmentId)
            .map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` })),
        },
      ]}
      submitLabel="Add to diploma"
      onSubmit={(values) => universityAction("post", `/courses/${course.id}/copy`, values)}
    />
  );
}

export function ExtraFeeDialog({ courseId, fee, ...props }: DialogProps & { courseId: number; fee?: ExtraFee }) {
  return (
    <FormDialog
      {...props}
      title={fee ? "Edit fee" : "Add fee"}
      description="An extra charge on top of the course fee, e.g. Uniform Fee."
      fields={[
        { name: "name", label: "Fee name", required: true, placeholder: "e.g. Uniform Fee" },
        { name: "amount", label: "Amount (Rs.)", type: "number", required: true, min: 1 },
      ]}
      initialValues={fee}
      submitLabel={fee ? "Save" : "Add fee"}
      onSubmit={(values) =>
        fee
          ? universityAction("put", `/courses/${courseId}/fees/${fee.id}`, values)
          : universityAction("post", `/courses/${courseId}/fees`, values)
      }
    />
  );
}

export function BatchDialog({ batch, ...props }: DialogProps & { batch?: BatchDetail }) {
  return (
    <FormDialog
      {...props}
      title={batch ? `Edit batch ${batch.name}` : "Add batch"}
      description={
        batch
          ? "Renaming moves its sections and students. Changing the year changes which diploma they study."
          : "Every diploma gets Sections A and B in the new batch."
      }
      fields={[
        { name: "name", label: "Batch name", required: true, placeholder: "e.g. 2027 or Spring-27" },
        { name: "year", label: "Intake year", type: "number", required: true, min: 2000, max: 2100 },
      ]}
      initialValues={batch ? { name: batch.name, year: batch.year } : { year: new Date().getFullYear() }}
      submitLabel={batch ? "Save" : "Add batch"}
      onSubmit={(values: Record<string, FieldValue>) =>
        batch
          ? universityAction("put", `/batches/${encodeURIComponent(batch.name)}`, values)
          : universityAction("post", "/batches", values)
      }
    />
  );
}
