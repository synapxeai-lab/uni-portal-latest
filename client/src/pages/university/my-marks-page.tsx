import { ClipboardList } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { useUniversityQuery } from "@/features/academics/api";
import { categoryLabel } from "@/features/academics/lib/marks";

interface CourseMarks {
  enrollmentId: number;
  code: string;
  name: string;
  section: { label: string };
  summary: { percentage: number | null; grade: string | null };
  categories: { id: number; type: string; weightage: number | null }[];
  marks: { id: number; categoryId: number; title: string; obtained: number | null; total: number }[];
}
interface MyMarks {
  groups: { semester: string; year: number; courses: CourseMarks[] }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** One course's marksheet: each assessment category of the scheme, with its items and marks. */
function CourseMarksheet({ course }: { course: CourseMarks }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-semibold">{course.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {course.code} · Section {course.section.label}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xl font-bold tabular-nums">
            {course.summary.percentage === null ? "-" : `${course.summary.percentage}%`}
          </span>
          {course.summary.grade ? <Badge variant="info">Grade {course.summary.grade}</Badge> : null}
        </div>
      </div>
      {course.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assessments set for this course yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead className="text-right">Marks</TableHead>
                <TableHead className="w-28 text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {course.categories.map((category) => {
                const items = course.marks.filter((m) => m.categoryId === category.id);
                return (
                  <CategoryBlock key={category.id} label={categoryLabel(category.type)} weightage={category.weightage} items={items} />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function CategoryBlock({ label, weightage, items }: { label: string; weightage: number | null; items: CourseMarks["marks"] }) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={3}>
          <span className="font-bold">{label}</span>
          {weightage ? <span className="text-xs text-muted-foreground"> · {weightage}% of the course</span> : null}
        </TableCell>
      </TableRow>
      {items.length === 0 ? (
        <TableRow>
          <TableCell colSpan={3} className="pl-6 text-sm text-muted-foreground">
            Nothing yet.
          </TableCell>
        </TableRow>
      ) : (
        items.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="pl-6">{m.title}</TableCell>
            <TableCell className="text-right tabular-nums">
              {m.obtained === null ? <span className="text-muted-foreground">Not marked</span> : `${m.obtained} / ${m.total}`}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {m.obtained === null ? "-" : `${Math.round((m.obtained / m.total) * 1000) / 10}%`}
            </TableCell>
          </TableRow>
        ))
      )}
    </>
  );
}

/** A student's marksheet: pick a course, see its assessments and marks. */
export default function MyMarksPage() {
  const query = useUniversityQuery<MyMarks>("/my/marks");
  const router = useRouter();
  const chosen = Number(useSearchParams().get("course"));
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ groups }) => {
        const courses = groups.flatMap((g) => g.courses);
        // The chosen course, else the first course of the latest term.
        const course = courses.find((c) => c.enrollmentId === chosen) ?? courses[0];
        return (
          <PageContainer>
            <SectionHeader
              title="Marks"
              description="Your marksheet as teachers grade your work. Grades appear once they're released."
              breadcrumbs={[{ label: "Marks" }]}
            />
            {!course ? (
              <EmptyState icon={ClipboardList} title="No courses yet" />
            ) : (
              <>
                <label className="flex w-full max-w-xl flex-col gap-1 text-sm font-medium">
                  Course
                  <Select
                    aria-label="Course"
                    value={String(course.enrollmentId)}
                    onChange={(e) => router.replace(`/my-marks?course=${e.target.value}`)}
                  >
                    {groups.map((group) => (
                      <optgroup key={`${group.semester}-${group.year}`} label={`${titleCase(group.semester)} ${group.year}`}>
                        {group.courses.map((c) => (
                          <option key={c.enrollmentId} value={c.enrollmentId}>
                            {c.code} {c.name} · Section {c.section.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </label>
                <CourseMarksheet key={course.enrollmentId} course={course} />
              </>
            )}
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
