import { CalendarCheck } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUniversityQuery } from "@/features/academics/api";
import { TableCard } from "@/features/academics/components/ui";

interface MyAttendance {
  groups: {
    semester: string;
    year: number;
    courses: {
      enrollmentId: number;
      code: string;
      name: string;
      section: { label: string };
      summary: { present: number; late: number; absent: number; total: number; percentage: number | null };
    }[];
  }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const rateVariant = (p: number | null) => (p === null ? "secondary" : p >= 75 ? "success" : p >= 60 ? "warning" : "destructive");

/** A student's attendance in every course, by term. */
export default function MyAttendancePage() {
  const query = useUniversityQuery<MyAttendance>("/my/attendance");
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ groups }) => (
        <PageContainer>
          <SectionHeader
            title="Attendance"
            description="Present and late both count as attended. Keep each course at 75% or above."
            breadcrumbs={[{ label: "Attendance" }]}
          />
          {groups.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No courses yet" />
          ) : (
            groups.map((group) => (
              <div key={`${group.semester}-${group.year}`} className="flex flex-col gap-2">
                <h2 className="font-heading text-base font-bold">
                  {titleCase(group.semester)} {group.year}
                </h2>
                <TableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Present</TableHead>
                        <TableHead className="text-right">Late</TableHead>
                        <TableHead className="text-right">Absent</TableHead>
                        <TableHead>Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.courses.map((course) => (
                        <TableRow key={course.enrollmentId}>
                          <TableCell>
                            <span className="flex flex-col">
                              <span className="font-semibold">{course.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {course.code} · Section {course.section.label}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{course.summary.present}</TableCell>
                          <TableCell className="text-right tabular-nums">{course.summary.late}</TableCell>
                          <TableCell className="text-right tabular-nums">{course.summary.absent}</TableCell>
                          <TableCell>
                            <Badge variant={rateVariant(course.summary.percentage)}>
                              {course.summary.percentage === null ? "Not taken yet" : `${course.summary.percentage}%`}
                            </Badge>
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
