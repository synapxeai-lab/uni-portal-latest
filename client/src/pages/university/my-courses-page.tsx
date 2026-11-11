import { BookOpen, ExternalLink } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUniversityQuery } from "@/features/academics/api";
import { TableCard } from "@/features/academics/components/ui";

interface MyCourses {
  groups: {
    semester: string;
    year: number;
    courses: {
      enrollmentId: number;
      id: number;
      code: string;
      name: string;
      creditHours: number;
      department: { code: string };
      section: { label: string };
      teacher: { name: string } | null;
      classroomId: string | null;
    }[];
  }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** A student's registered courses by term, each opening its classroom. */
export default function MyCoursesPage() {
  const query = useUniversityQuery<MyCourses>("/my/courses");
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ groups }) => (
        <PageContainer>
          <SectionHeader
            title="My courses"
            description="The courses you're registered in. Each has a classroom for its stream and classwork."
            breadcrumbs={[{ label: "My courses" }]}
            actions={
              <Button variant="outline" asChild>
                <Link href="/registration">Register for courses</Link>
              </Button>
            }
          />
          {groups.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" description="Register for this term's courses to see them here." />
          ) : (
            groups.map((group) => (
              <div key={`${group.semester}-${group.year}`} className="flex flex-col gap-2">
                <h2 className="font-heading text-base font-bold">
                  {titleCase(group.semester)} {group.year} ·{" "}
                  {group.courses.reduce((sum, c) => sum + c.creditHours, 0)} credit hours
                </h2>
                <TableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="w-0" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.courses.map((course) => (
                        <TableRow key={course.enrollmentId}>
                          <TableCell>
                            <span className="flex flex-col">
                              <span className="font-semibold">{course.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">{course.code}</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            {course.department.code} · {course.section.label}
                          </TableCell>
                          <TableCell>{course.teacher?.name ?? "-"}</TableCell>
                          <TableCell className="text-right tabular-nums">{course.creditHours}</TableCell>
                          <TableCell>
                            {course.classroomId ? (
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/classes/${course.classroomId}`}>
                                  Classroom <ExternalLink />
                                </Link>
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableCard>
              </div>
            ))
          )}
        </PageContainer>
      )}
    </QueryView>
  );
}
