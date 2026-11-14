import { useState } from "react";
import { useParams } from "react-router";
import { BookOpen, ExternalLink, UserMinus, UserPlus, Users } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { queryString, universityAction, useSection, useUniversityQuery } from "@/features/academics/api";
import type { StudentRecord } from "@/features/academics/components/people-dialogs";
import { runAction, TableCard } from "@/features/academics/components/ui";

/** Picks a student of the section's programme and batch who isn't in it yet. */
function AddStudentControl({
  sectionId,
  programme,
  batch,
  memberIds,
}: {
  sectionId: number;
  programme: string;
  batch: string;
  memberIds: number[];
}) {
  const [studentId, setStudentId] = useState("");
  const candidates = (
    useUniversityQuery<{ students: StudentRecord[] }>(`/students${queryString({ programme, batch })}`).data
      ?.students ?? []
  ).filter((student) => !memberIds.includes(student.id));
  if (candidates.length === 0) {
    return null;
  }
  return (
    <div className="flex gap-2">
      <Select className="w-56" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Student to add">
        <option value="">Add a student…</option>
        {candidates.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name} ({student.rollNo})
          </option>
        ))}
      </Select>
      <Button
        variant="outline"
        disabled={!studentId}
        onClick={async () => {
          if (await runAction(universityAction("post", `/sections/${sectionId}/students`, { studentId: Number(studentId) }))) {
            setStudentId("");
          }
        }}
      >
        <UserPlus /> Add
      </Button>
    </div>
  );
}

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
                          <Link href={`/admin/courses/${link.courseId}`} className="font-semibold">
                            {link.course.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{link.course.creditHours}</TableCell>
                        <TableCell>{link.teacher?.name ?? <span className="text-muted-foreground">Not assigned</span>}</TableCell>
                        <TableCell>
                          {link.classroom ? (
                            <Link href={`/classes/${link.classroom.id}`} className="inline-flex items-center gap-1 text-link">
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-base font-bold">Students ({section.students.length})</h2>
              <AddStudentControl
                sectionId={section.id}
                programme={section.department.category}
                batch={section.batch}
                memberIds={section.students.map((s) => s.id)}
              />
            </div>
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
                      <TableHead className="w-0" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono text-xs">{student.rollNo}</TableCell>
                        <TableCell>
                          <Link href={`/admin/students/${student.id}`} className="font-semibold">
                            {student.name}
                          </Link>
                        </TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.phone}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${student.name} from this section`}
                            onClick={() =>
                              runAction(universityAction("delete", `/sections/${section.id}/students/${student.id}`))
                            }
                          >
                            <UserMinus />
                          </Button>
                        </TableCell>
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
