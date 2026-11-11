import { useParams } from "react-router";
import { BookOpen, ExternalLink, Users } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSection } from "@/features/academics/api";
import { TableCard } from "@/features/academics/components/ui";

/** One section: the courses offered to it (teacher and classroom) and its students. */
export default function SectionPage() {
  const id = Number(useParams().id);
  const query = useSection(id);

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ section }) => (
        <PageContainer>
          <SectionHeader
            title={`${section.department.code} · Batch ${section.batch} · Section ${section.label}`}
            description={section.department.name}
            breadcrumbs={[
              { label: "Batches", href: "/admin/batches" },
              { label: section.batch, href: `/admin/batches/${encodeURIComponent(section.batch)}` },
              { label: `${section.department.code} ${section.label}` },
            ]}
          />

          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-base font-bold">Courses offered ({section.courseLinks.length})</h2>
            {section.courseLinks.length === 0 ? (
              <EmptyState icon={BookOpen} title="No courses offered yet" />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Classroom</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.courseLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-mono text-xs">{link.course.code}</TableCell>
                        <TableCell>
                          <Link href={`/admin/courses/${link.courseId}`} className="font-semibold hover:underline">
                            {link.course.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{link.course.creditHours}</TableCell>
                        <TableCell>{link.teacher?.name ?? <span className="text-muted-foreground">Not assigned</span>}</TableCell>
                        <TableCell>
                          {link.classroom ? (
                            <Link href={`/classes/${link.classroom.id}`} className="inline-flex items-center gap-1 text-link hover:underline">
                              Open <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-base font-bold">Students ({section.students.length})</h2>
            {section.students.length === 0 ? (
              <EmptyState icon={Users} title="No students in this section yet" />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll no.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono text-xs">{student.rollNo}</TableCell>
                        <TableCell className="font-semibold">{student.name}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
          </div>
        </PageContainer>
      )}
    </QueryView>
  );
}
