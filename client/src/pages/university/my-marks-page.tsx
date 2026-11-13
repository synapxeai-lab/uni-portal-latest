import { ClipboardList } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <TableCell colSpan={2}>
          <span className="font-bold">{label}</span>
          {weightage ? <span className="text-xs text-muted-foreground"> · {weightage}% of the course</span> : null}
        </TableCell>
      </TableRow>
      {items.length === 0 ? (
        <TableRow>
          <TableCell colSpan={2} className="pl-6 text-sm text-muted-foreground">
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
          </TableRow>
        ))
      )}
    </>
  );
}

/** A student's marksheet for every course, by term. */
export default function MyMarksPage() {
  const query = useUniversityQuery<MyMarks>("/my/marks");
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ groups }) => (
        <PageContainer>
          <SectionHeader
            title="Marks"
            description="Your marksheet as teachers grade your work. Grades appear once they're released."
            breadcrumbs={[{ label: "Marks" }]}
          />
          {groups.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No courses yet" />
          ) : (
            groups.map((group) => (
              <div key={`${group.semester}-${group.year}`} className="flex flex-col gap-3">
                <h2 className="font-heading text-base font-bold">
                  {titleCase(group.semester)} {group.year}
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.courses.map((course) => (
                    <CourseMarksheet key={course.enrollmentId} course={course} />
                  ))}
                </div>
              </div>
            ))
          )}
        </PageContainer>
      )}
    </QueryView>
  );
}
