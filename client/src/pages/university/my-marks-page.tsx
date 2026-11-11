import { ClipboardList } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useUniversityQuery } from "@/features/academics/api";
import { categoryLabel } from "@/features/academics/lib/marks";

interface MyMarks {
  groups: {
    semester: string;
    year: number;
    courses: {
      enrollmentId: number;
      code: string;
      name: string;
      section: { label: string };
      summary: { percentage: number | null; grade: string | null };
      marks: { id: number; type: string; title: string; obtained: number | null; total: number }[];
    }[];
  }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** A student's marks in every course, by term. */
export default function MyMarksPage() {
  const query = useUniversityQuery<MyMarks>("/my/marks");
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ groups }) => (
        <PageContainer>
          <SectionHeader
            title="Marks"
            description="Your marks as teachers grade your work. Grades appear once they're released."
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
                <div className="grid gap-3 md:grid-cols-2">
                  {group.courses.map((course) => (
                    <Card key={course.enrollmentId} className="flex flex-col gap-3 p-4">
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
                      {course.marks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nothing graded yet.</p>
                      ) : (
                        <ul className="flex flex-col divide-y divide-border text-sm">
                          {course.marks.map((m) => (
                            <li key={m.id} className="flex justify-between py-1.5">
                              <span>
                                {m.title} <span className="text-xs text-muted-foreground">· {categoryLabel(m.type)}</span>
                              </span>
                              <span className="tabular-nums">
                                {m.obtained === null ? <span className="text-muted-foreground">-</span> : `${m.obtained} / ${m.total}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
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
