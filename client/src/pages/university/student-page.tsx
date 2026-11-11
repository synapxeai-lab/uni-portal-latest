import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { BookOpen, ExternalLink, Pencil, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import {
  universityAction,
  useBatches,
  useProgrammeCategories,
  useProgrammeLookup,
  useUniversityQuery,
} from "@/features/academics/api";
import { StudentDialog, type StudentRecord } from "@/features/academics/components/people-dialogs";
import { Fact, ordinal, runAction, TableCard } from "@/features/academics/components/ui";

interface StudentDetail {
  student: StudentRecord & {
    enrolledSections: { id: number; label: string; batch: string; department: { id: number; name: string; code: string } }[];
  };
  groups: {
    semester: string;
    year: number;
    semesterNumber: number | null;
    diploma: { name: string; code: string };
    courses: {
      enrollmentId: number;
      id: number;
      code: string;
      name: string;
      creditHours: number;
      section: { id: number; label: string };
      teacher: { name: string } | null;
      classroomId: string | null;
      grade: string | null;
    }[];
  }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** One student's record, sections and registrations by term. */
export default function StudentPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const query = useUniversityQuery<StudentDetail>(`/students/${id}`);
  const categories = useProgrammeCategories().data?.categories ?? [];
  const batches = useBatches().data?.batches ?? [];
  const programmeOf = useProgrammeLookup();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ student, groups }) => (
        <PageContainer>
          <SectionHeader
            title={student.name}
            description={`${student.rollNo} · ${programmeOf(student.programme)?.label ?? student.programme}`}
            breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: student.name }]}
            actions={
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Edit
                </Button>
                <Button variant="outline" onClick={() => setDeleting(true)}>
                  <Trash2 /> Delete
                </Button>
              </>
            }
          />

          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
            <Fact label="Email">{student.email}</Fact>
            <Fact label="Phone">{student.phone}</Fact>
            <Fact label="CNIC">{student.cnic}</Fact>
            <Fact label="Date of birth">{student.dob ? student.dob.toLocaleDateString() : "-"}</Fact>
            <Fact label="Batch / section">
              {student.batch} · {student.section}
            </Fact>
            <Fact label="Current diploma">
              {student.currentDiploma
                ? `${student.currentDiploma.code} (${ordinal(student.currentDiploma.semester)} semester)`
                : "-"}
            </Fact>
            <Fact label="Last qualification">
              {[student.lastQualification, student.grade, student.passingYear].filter(Boolean).join(" · ") || "-"}
            </Fact>
            <Fact label="Guardian">
              {student.guardianName}
              {student.guardianRelationship ? ` (${student.guardianRelationship})` : ""} · {student.guardianContact}
            </Fact>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {student.enrolledSections.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not in any section yet.</p>
              ) : (
                student.enrolledSections.map((section) => (
                  <Link
                    key={section.id}
                    href={`/admin/sections/${section.id}`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-gold hover:bg-accent"
                  >
                    {section.department.code} · Section {section.label}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-base font-bold">Registrations</h2>
            {groups.length === 0 ? (
              <EmptyState icon={BookOpen} title="No registrations yet" />
            ) : (
              groups.map((group) => (
                <div key={`${group.semester}-${group.year}`} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">
                    {titleCase(group.semester)} {group.year}
                    {group.semesterNumber ? ` · ${ordinal(group.semesterNumber)} semester` : ""} · {group.diploma.code}
                  </p>
                  <TableCard>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Teacher</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Class</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.courses.map((course) => (
                          <TableRow key={course.enrollmentId}>
                            <TableCell>
                              <span className="font-mono text-xs">{course.code}</span> {course.name}
                            </TableCell>
                            <TableCell>{course.section.label}</TableCell>
                            <TableCell>{course.teacher?.name ?? "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{course.creditHours}</TableCell>
                            <TableCell>{course.grade ? <Badge variant="info">{course.grade}</Badge> : "-"}</TableCell>
                            <TableCell>
                              {course.classroomId ? (
                                <Link href={`/classes/${course.classroomId}`} className="inline-flex items-center gap-1 text-link hover:underline">
                                  Open <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableCard>
                </div>
              ))
            )}
          </div>

          <StudentDialog
            open={editing}
            onOpenChange={setEditing}
            student={student}
            categories={categories}
            batches={batches}
          />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={`Delete ${student.name}?`}
            description="Their registrations, attendance, marks and challans are deleted, and their login is archived."
            confirmLabel="Delete"
            destructive
            pending={pending}
            onConfirm={async () => {
              setPending(true);
              const ok = await runAction(universityAction("delete", `/students/${student.id}`));
              setPending(false);
              setDeleting(false);
              if (ok) navigate("/admin/students");
            }}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
