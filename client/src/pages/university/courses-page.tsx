import { useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  universityAction,
  useCourses,
  useDepartments,
  useProgrammeCategories,
} from "@/features/academics/api";
import { CourseDialog } from "@/features/academics/components/structure-dialogs";
import { formatRs, ordinal, runAction, TableCard } from "@/features/academics/components/ui";
import type { Course } from "@/features/academics/types";

/** Every course across all diplomas, filterable by programme, semester and status. */
export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [semester, setSemester] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const query = useCourses({ search: debouncedSearch, category, semester, status });
  const categories = useProgrammeCategories().data?.categories ?? [];
  const departments = useDepartments().data?.departments ?? [];
  const semesters = [...new Set(departments.filter((d) => !category || d.category === category).map((d) => d.semester))].sort(
    (a, b) => a - b,
  );
  const [editing, setEditing] = useState<Course | "new" | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <PageContainer>
      <SectionHeader
        title="Courses"
        description="Every course across all diplomas, with its fee and whether it's offered."
        breadcrumbs={[{ label: "Courses" }]}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add course
          </Button>
        }
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Search name or code" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search courses" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Programme">
          <option value="">All programmes</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={semester} onChange={(e) => setSemester(e.target.value)} aria-label="Semester">
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s} value={s}>
              {ordinal(s)} semester
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Offered or not</option>
          <option value="ACTIVE">Offered</option>
          <option value="INACTIVE">Not offered</option>
        </Select>
      </div>

      <QueryView query={query} loading={<AdminLoading />}>
        {({ courses }) =>
          courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses found" description="Try another filter, or add a course." />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Diploma</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Total fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-mono text-xs">{course.code}</TableCell>
                      <TableCell>
                        <Link href={`/admin/courses/${course.id}`} className="font-semibold">
                          {course.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/diplomas/${course.departmentId}`} className="text-sm">
                          {course.department?.code}
                        </Link>
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {course.department ? ordinal(course.department.semester) : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{course.creditHours}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRs(course.totalFee ?? course.fee)}</TableCell>
                      <TableCell>
                        <Badge variant={course.status === "ACTIVE" ? "success" : "secondary"}>
                          {course.status === "ACTIVE" ? "Offered" : "Not offered"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" aria-label="Edit course" onClick={() => setEditing(course)}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete course" onClick={() => setDeleting(course)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )
        }
      </QueryView>

      <CourseDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        course={editing === "new" || editing === null ? undefined : editing}
        departments={departments}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete course?"
        description={deleting ? `Delete ${deleting.code} - ${deleting.name}? Its registrations, attendance and marks are deleted too.` : ""}
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          await runAction(universityAction("delete", `/courses/${deleting.id}`));
          setPending(false);
          setDeleting(null);
        }}
      />
    </PageContainer>
  );
}
