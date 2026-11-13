import { useState } from "react";
import { CalendarCheck } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { queryString, useProgrammeCategories, useUniversityQuery } from "@/features/academics/api";
import { TableCard } from "@/features/academics/components/ui";

interface Overview {
  offerings: {
    sectionId: number;
    courseId: number;
    course: { code: string; name: string };
    section: { label: string; batch: string; department: { code: string } };
    teacher: { name: string } | null;
    classroomId: string | null;
    students: number;
    days: number;
    percentage: number | null;
  }[];
}

const rateVariant = (p: number | null) => (p === null ? "secondary" : p >= 75 ? "success" : p >= 60 ? "warning" : "destructive");

/** Admin: attendance across every offering; each opens its classroom's Attendance tab. */
export default function AttendanceOverviewPage() {
  const [category, setCategory] = useState("");
  const categories = useProgrammeCategories().data?.categories ?? [];
  const query = useUniversityQuery<Overview>(`/attendance${queryString({ category })}`, { keepPrevious: true });

  return (
    <PageContainer>
      <SectionHeader
        title="Attendance"
        description="Attendance is taken in each course's classroom. Rates below 75% are highlighted."
        breadcrumbs={[{ label: "Attendance" }]}
      />
      <Select className="sm:max-w-xs" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Programme">
        <option value="">All programmes</option>
        {categories.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </Select>
      <QueryView query={query} loading={<AdminLoading />}>
        {({ offerings }) =>
          offerings.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No courses offered yet" />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offerings.map((o) => (
                    <TableRow key={`${o.sectionId}-${o.courseId}`}>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="font-semibold">{o.course.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{o.course.code}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.section.department.code} {o.section.batch}-{o.section.label}
                      </TableCell>
                      <TableCell className="text-sm">{o.teacher?.name ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.students}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.days}</TableCell>
                      <TableCell>
                        <Badge variant={rateVariant(o.percentage)}>{o.percentage === null ? "No data" : `${o.percentage}%`}</Badge>
                      </TableCell>
                      <TableCell>
                        {o.classroomId ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/attendance/${o.sectionId}/${o.courseId}`}>Open</Link>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )
        }
      </QueryView>
    </PageContainer>
  );
}
