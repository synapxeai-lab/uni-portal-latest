import { useState } from "react";
import { ExternalLink, UserRoundCheck } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import {
  queryString,
  universityAction,
  useDepartments,
  useProgrammeCategories,
  useUniversityQuery,
} from "@/features/academics/api";
import type { TeacherRecord } from "@/features/academics/components/people-dialogs";
import { runAction, TableCard } from "@/features/academics/components/ui";

interface AssignmentCourse {
  id: number;
  code: string;
  name: string;
  department: { code: string; name: string };
  rows: {
    key: string;
    sectionId: number;
    courseId: number;
    section: { label: string; batch: string };
    offered: boolean;
    classroomId: string | null;
    teacher: { id: number; name: string } | null;
  }[];
}

/**
 * Assign teachers: one row per course and section. The teacher of an offered
 * course owns its classroom; before it's offered the teacher is only planned.
 */
export default function AssignTeachersPage() {
  const categories = useProgrammeCategories().data?.categories ?? [];
  const [category, setCategory] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const departments = (useDepartments().data?.departments ?? []).filter((d) => !category || d.category === category);
  const query = useUniversityQuery<{ courses: AssignmentCourse[] }>(
    `/assignments${queryString({ category, departmentId })}`,
    { keepPrevious: true },
  );
  const teachers = useUniversityQuery<{ teachers: TeacherRecord[] }>("/teachers").data?.teachers ?? [];
  const [saving, setSaving] = useState<string | null>(null);

  return (
    <PageContainer>
      <SectionHeader
        title="Assign teachers"
        description="The assigned teacher teaches the course to that section and owns its classroom."
        breadcrumbs={[{ label: "Assign teachers" }]}
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setDepartmentId("");
          }}
          aria-label="Programme"
        >
          <option value="">All programmes</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Diploma">
          <option value="">All diplomas</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} - {d.name}
            </option>
          ))}
        </Select>
      </div>
      <QueryView query={query} loading={<AdminLoading />}>
        {({ courses }) =>
          courses.length === 0 ? (
            <EmptyState icon={UserRoundCheck} title="No courses with sections" description="Add a batch so diplomas have sections." />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Batch · section</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-56">Teacher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.flatMap((course) =>
                    course.rows.map((row, index) => (
                      <TableRow key={row.key}>
                        <TableCell>
                          {index === 0 ? (
                            <span className="flex flex-col">
                              <span className="font-semibold">{course.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {course.code} · {course.department.code}
                              </span>
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.section.batch} · {row.section.label}
                        </TableCell>
                        <TableCell>
                          {row.offered ? (
                            <span className="flex items-center gap-1.5">
                              <Badge variant="success">Offered</Badge>
                              {row.classroomId ? (
                                <Link href={`/classes/${row.classroomId}`} aria-label="Open classroom" className="text-link">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                              ) : null}
                            </span>
                          ) : (
                            <Badge variant="secondary">Planned</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            aria-label={`Teacher for ${course.code} section ${row.section.label}`}
                            value={row.teacher?.id ?? ""}
                            disabled={saving === row.key}
                            onChange={async (e) => {
                              setSaving(row.key);
                              await runAction(
                                universityAction("put", `/assignments/${row.sectionId}/${row.courseId}`, {
                                  teacherId: e.target.value ? Number(e.target.value) : null,
                                }),
                              );
                              setSaving(null);
                            }}
                          >
                            <option value="">Not assigned</option>
                            {teachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.name}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </TableCard>
          )
        }
      </QueryView>
    </PageContainer>
  );
}
