import { useState } from "react";
import { useParams } from "react-router";
import { BookOpen, Copy, LayoutList, Pencil, Plus, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import {
  universityAction,
  useBatches,
  useDepartment,
  useDepartments,
  useProgrammeCategories,
  useProgrammeLookup,
} from "@/features/academics/api";
import { CopyCourseDialog, CourseDialog, DiplomaDialog } from "@/features/academics/components/structure-dialogs";
import { Fact, formatRs, ordinal, runAction, TableCard } from "@/features/academics/components/ui";
import type { Course } from "@/features/academics/types";
import { cn } from "@/lib/utils";

type Tab = "courses" | "sections";

/** One diploma: its details, courses (with fees) and sections per batch. */
export default function DiplomaPage() {
  const id = Number(useParams().id);
  const query = useDepartment(id);
  const departments = useDepartments().data?.departments ?? [];
  const categories = useProgrammeCategories().data?.categories ?? [];
  const batches = useBatches().data?.batches ?? [];
  const programmeOf = useProgrammeLookup();
  const [tab, setTab] = useState<Tab>("courses");
  const [editingDiploma, setEditingDiploma] = useState(false);
  const [courseDialog, setCourseDialog] = useState<Course | "new" | null>(null);
  const [copying, setCopying] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<{ label: string; url: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [newSectionBatch, setNewSectionBatch] = useState("");

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ department }) => {
        const programme = programmeOf(department.category);
        const sectionsByBatch = new Map<string, typeof department.sections>();
        for (const section of department.sections) {
          sectionsByBatch.set(section.batch, [...(sectionsByBatch.get(section.batch) ?? []), section]);
        }
        return (
          <PageContainer>
            <SectionHeader
              title={department.name}
              description={department.description}
              breadcrumbs={[
                { label: "Programmes", href: "/admin/programmes" },
                ...(programme ? [{ label: programme.label, href: `/admin/programmes/${programme.slug}` }] : []),
                { label: department.code },
              ]}
              actions={
                <Button variant="outline" onClick={() => setEditingDiploma(true)}>
                  <Pencil /> Edit diploma
                </Button>
              }
            />

            <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
              <Fact label="Code">{department.code}</Fact>
              <Fact label="Semester">{ordinal(department.semester)}</Fact>
              <Fact label="Head">{department.head}</Fact>
              <Fact label="Courses">{department.courses.length}</Fact>
              <Fact label="Students">{department.studentsCount}</Fact>
              <Fact label="Diploma fee">
                {formatRs(department.netFee)}
                {department.discountRate > 0 ? (
                  <span className="ml-1 text-xs text-muted-foreground">({department.discountRate}% off whole diploma)</span>
                ) : null}
              </Fact>
            </Card>

            <div className="flex gap-1 border-b border-border" role="tablist">
              {(
                [
                  ["courses", `Courses (${department.courses.length})`],
                  ["sections", `Sections (${department.sections.length})`],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
                    tab === key ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "courses" ? (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button onClick={() => setCourseDialog("new")}>
                    <Plus /> Add course
                  </Button>
                </div>
                {department.courses.length === 0 ? (
                  <EmptyState icon={BookOpen} title="No courses yet" />
                ) : (
                  <TableCard>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead className="text-right">Credit hours</TableHead>
                          <TableHead className="text-right">Total fee</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-0" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {department.courses.map((course) => (
                          <TableRow key={course.id}>
                            <TableCell className="font-mono text-xs">{course.code}</TableCell>
                            <TableCell>
                              <Link href={`/admin/courses/${course.id}`} className="font-semibold">
                                {course.name}
                              </Link>
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
                                <Button variant="ghost" size="icon" aria-label="Edit course" onClick={() => setCourseDialog(course)}>
                                  <Pencil />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="Add to another diploma" onClick={() => setCopying(course)}>
                                  <Copy />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete course"
                                  onClick={() => setDeleting({ label: course.name, url: `/courses/${course.id}` })}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableCard>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Select
                    className="w-44"
                    value={newSectionBatch}
                    onChange={(e) => setNewSectionBatch(e.target.value)}
                    aria-label="Batch for the new section"
                  >
                    <option value="">Select batch</option>
                    {batches.map((batch) => (
                      <option key={batch} value={batch}>
                        Batch {batch}
                      </option>
                    ))}
                  </Select>
                  <Button
                    disabled={!newSectionBatch}
                    onClick={() =>
                      runAction(universityAction("post", "/sections", { departmentId: department.id, batch: newSectionBatch }))
                    }
                  >
                    <Plus /> Add section
                  </Button>
                </div>
                {sectionsByBatch.size === 0 ? (
                  <EmptyState icon={LayoutList} title="No sections yet" description="Add a batch to create Sections A and B." />
                ) : (
                  [...sectionsByBatch.entries()].map(([batch, sections]) => (
                    <div key={batch} className="flex flex-col gap-2">
                      <h2 className="text-sm font-bold text-foreground">Batch {batch}</h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sections.map((section) => (
                          <Card key={section.id} className="flex items-center justify-between gap-3 p-4">
                            <Link href={`/admin/sections/${section.id}`} className="flex flex-col">
                              <span className="font-semibold">Section {section.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {section._count.students} students · {section.courseLinks.length} courses offered
                              </span>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete section ${section.label}`}
                              onClick={() =>
                                setDeleting({ label: `Section ${section.label} (batch ${batch})`, url: `/sections/${section.id}` })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <DiplomaDialog
              open={editingDiploma}
              onOpenChange={setEditingDiploma}
              department={department}
              categories={categories}
            />
            <CourseDialog
              open={courseDialog !== null}
              onOpenChange={(open) => !open && setCourseDialog(null)}
              course={courseDialog === "new" || courseDialog === null ? undefined : courseDialog}
              departments={departments}
              defaultDepartmentId={department.id}
            />
            {copying ? (
              <CopyCourseDialog
                open
                onOpenChange={(open) => !open && setCopying(null)}
                course={copying}
                departments={departments}
              />
            ) : null}
            <ConfirmDialog
              open={deleting !== null}
              onOpenChange={(open) => !open && setDeleting(null)}
              title={`Delete ${deleting?.label}?`}
              description="Its offerings, registrations, attendance and marks are deleted too. This cannot be undone."
              confirmLabel="Delete"
              destructive
              pending={pending}
              onConfirm={async () => {
                if (!deleting) return;
                setPending(true);
                await runAction(universityAction("delete", deleting.url));
                setPending(false);
                setDeleting(null);
              }}
            />
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
