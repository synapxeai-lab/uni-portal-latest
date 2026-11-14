import { useState } from "react";
import { useParams } from "react-router";
import { Hash, Mail, Phone, Trash2, User, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BackLink,
  BlockHeading,
  CardGrid,
  ClassicButton,
  ClassicConfirm,
  DetailHeader,
  NavLink,
  RowButton,
  TableEmpty,
  useViewMode,
  ViewToggle,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useRouter } from "@/lib/navigation";
import { universityAction, useSection } from "@/features/academics/api";
import { ClassicAssignTeacherModal } from "@/features/academics/components/classic-assign-teacher-modal";
import { runAction, TableCard } from "@/features/academics/components/ui";
import type { SectionCourseLink } from "@/features/academics/types";

/**
 * One section (admin): an exact replica of the old University Portal's
 * section page - header card with Delete Section, the courses with their
 * teachers (assign / reassign) and the enrolled students.
 */

const muted = "whitespace-nowrap text-[0.8rem] text-muted-foreground";

export default function SectionPage() {
  const id = Number(useParams().id);
  const router = useRouter();
  const query = useSection(id);
  const [view, setView] = useViewMode();
  const [assigning, setAssigning] = useState<SectionCourseLink | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);
  const section = query.data?.section;

  async function assign(teacherId: number) {
    if (!assigning) return null;
    const result = await universityAction<{ message?: string }>("put", `/assignments/${id}/${assigning.courseId}`, { teacherId });
    if (result.status !== "success") return result.message || "Failed to assign teacher.";
    toast.success(result.data?.message ?? "Teacher assigned.");
    setAssigning(null);
    return null;
  }

  async function deleteSection() {
    if (!section) return;
    setDeletingSection(false);
    const ok = await runAction(universityAction("delete", `/sections/${id}`), `Section ${section.label} deleted.`);
    if (ok) router.push(`/admin/diplomas/${section.departmentId}/sections`);
  }

  return (
    <PageContainer className="gap-0">
      <BackLink fallback={section ? `/admin/diplomas/${section.departmentId}/sections` : "/admin/programmes"}>
        Back to {section ? `${section.department.name} Sections` : "Sections"}
      </BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={6} />}>
          {({ section: s }) => {
            const { department, students, courseLinks } = s;
            const withTeacher = courseLinks.filter((l) => l.teacher).length;
            return (
              <>
                <DetailHeader
                  tile={department.code}
                  color={department.color}
                  bg={department.bg}
                  title={`Section ${s.label} · Batch ${s.batch}`}
                  subtitle={
                    <NavLink href={`/admin/diplomas/${department.id}`} className="font-semibold text-foreground">
                      {department.name} ({department.code})
                    </NavLink>
                  }
                  meta={
                    <>
                      <span>
                        <User aria-hidden /> {students.length} students enrolled
                      </span>
                      <span>
                        <UserCheck aria-hidden /> {withTeacher} of {courseLinks.length} courses have a teacher
                      </span>
                    </>
                  }
                  action={
                    <ClassicButton variant="danger" onClick={() => setDeletingSection(true)}>
                      <Trash2 className="size-[14px]" /> Delete Section
                    </ClassicButton>
                  }
                />

                {/* HeadingWithToggle */}
                <div className="mb-[0.9rem] flex flex-wrap items-center justify-between gap-3">
                  <BlockHeading className="mb-0">Courses &amp; Assigned Teachers</BlockHeading>
                  <ViewToggle view={view} onChange={setView} />
                </div>

                {courseLinks.length > 0 && view === "list" ? (
                  <TableCard className="mb-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courseLinks.map((link) => (
                          <TableRow key={link.id} className="[&>td]:whitespace-normal">
                            <TableCell className="font-semibold">
                              <NavLink href={`/admin/courses/${link.courseId}`}>{link.course.code}</NavLink>
                            </TableCell>
                            <TableCell>{link.course.name}</TableCell>
                            <TableCell>{link.teacher ? link.teacher.name : <span className={muted}>No teacher assigned yet</span>}</TableCell>
                            <TableCell>
                              {link.teacher ? (
                                <>
                                  <div className="max-w-[220px] truncate text-mid-foreground">{link.teacher.email}</div>
                                  <div className={muted}>{link.teacher.phone}</div>
                                </>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <RowButton
                                  kind="edit"
                                  icon={UserCheck}
                                  label={link.teacher ? "Reassign" : "Assign"}
                                  onClick={() => setAssigning(link)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableCard>
                ) : (
                  <div className="mb-6">
                    {courseLinks.length === 0 ? (
                      <TableEmpty>No courses offered to this section yet. Use the Offer Courses page to add some.</TableEmpty>
                    ) : (
                      <CardGrid>
                        {courseLinks.map((link) => (
                          <div
                            key={link.id}
                            className="rounded-[10px] border border-border bg-card p-[1.1rem] shadow-[0_1px_2px_rgba(23,31,50,.05)]"
                          >
                            <div className="mb-3 flex items-center justify-between gap-[0.6rem]">
                              <NavLink href={`/admin/courses/${link.courseId}`} className="text-[0.8rem] font-bold text-foreground">
                                {link.course.code}
                              </NavLink>
                              <ClassicButton variant="outline" className="px-3 py-[0.35rem] text-[0.78rem]" onClick={() => setAssigning(link)}>
                                <UserCheck className="size-[14px]" /> {link.teacher ? "Reassign" : "Assign"}
                              </ClassicButton>
                            </div>
                            <p className="mb-2 text-[0.87rem] font-semibold text-foreground">{link.course.name}</p>
                            {link.teacher ? (
                              <div className="flex flex-col gap-1">
                                <p className="text-[0.87rem] font-semibold text-foreground">{link.teacher.name}</p>
                                <p className="flex items-center gap-[0.4rem] text-[0.78rem] text-muted-foreground">
                                  <Phone className="size-3" aria-hidden /> {link.teacher.phone}
                                </p>
                                <p className="flex items-center gap-[0.4rem] text-[0.78rem] text-muted-foreground">
                                  <Mail className="size-3" aria-hidden /> {link.teacher.email}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[0.82rem] text-muted-foreground">No teacher assigned yet.</p>
                            )}
                          </div>
                        ))}
                      </CardGrid>
                    )}
                  </div>
                )}

                <BlockHeading className="mb-[0.9rem]">Enrolled Students</BlockHeading>
                <div className="flex flex-col gap-[0.65rem]">
                  {students.length === 0 ? (
                    <TableEmpty>No students enrolled in this section yet.</TableEmpty>
                  ) : (
                    students.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center gap-4 rounded-[10px] border border-border bg-card px-5 py-4 shadow-[0_1px_2px_rgba(23,31,50,.05)] max-[640px]:flex-wrap"
                      >
                        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-md bg-[#f0fdf4] text-[#15803d] dark:bg-success-soft dark:text-success">
                          <User className="size-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <NavLink href={`/admin/students/${st.id}`} className="text-[0.92rem] font-bold text-foreground">
                            {st.name}
                          </NavLink>
                          <div className="ml-auto mt-[0.2rem] grid w-fit grid-cols-[repeat(2,auto)] gap-x-[0.9rem] gap-y-[0.15rem] text-right text-[0.74rem] text-muted-foreground max-[640px]:ml-0 max-[640px]:text-left [&>span]:inline-flex [&>span]:items-center [&>span]:justify-end [&>span]:gap-[0.3rem] max-[640px]:[&>span]:justify-start">
                            <span>
                              <Hash className="size-[13px]" aria-hidden /> {st.rollNo}
                            </span>
                            <span>
                              <Phone className="size-[13px]" aria-hidden /> {st.phone}
                            </span>
                            <span>
                              <Mail className="size-[13px]" aria-hidden /> {st.email}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-[0.4rem]">
                          <RowButton
                            kind="delete"
                            icon={Trash2}
                            label="Remove"
                            title="Remove from section"
                            onClick={() =>
                              runAction(universityAction("delete", `/sections/${id}/students/${st.id}`), "Student removed from section.")
                            }
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {assigning ? (
                  <ClassicAssignTeacherModal
                    title={assigning.course.name}
                    programme={department.category}
                    onClose={() => setAssigning(null)}
                    onAssign={assign}
                  />
                ) : null}
              </>
            );
          }}
        </QueryView>
      </div>
      <ClassicConfirm
        open={deletingSection}
        title="Delete Section"
        message={`Are you sure you want to delete Section ${section?.label}? Any enrolled students will be unenrolled and all per-course teacher assignments will be removed. This action cannot be undone.`}
        onConfirm={deleteSection}
        onCancel={() => setDeletingSection(false)}
      />
    </PageContainer>
  );
}
