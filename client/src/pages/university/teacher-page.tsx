import { useState } from "react";
import { useParams } from "react-router";
import { BookOpen, Briefcase, Clock, Mail, Pencil, Phone } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BackLink,
  BlockHeading,
  ClassicButton,
  ColorPill,
  DetailHeader,
  DetailsField,
  DetailsSection,
  NavLink,
  StatusPill,
  TableEmpty,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useProgrammeCategories, useUniversityQuery } from "@/features/academics/api";
import { ClassicTeacherModal, payRateText, teacherTypeByKey } from "@/features/academics/components/classic-teacher-modal";
import type { TeacherRecord } from "@/features/academics/components/people-dialogs";
import { TableCard } from "@/features/academics/components/ui";

/**
 * One teacher's record (admin), laid out like the student page: a header
 * card, the details sections and the courses they teach per section.
 */

type TeacherDetail = TeacherRecord & {
  sectionCourses: (TeacherRecord["sectionCourses"][number] & {
    section: { department: { id: number; code: string; name: string; color: string; bg: string } };
  })[];
};

export default function TeacherPage() {
  const id = Number(useParams().id);
  const query = useUniversityQuery<{ teacher: TeacherDetail }>(`/teachers/${id}`);
  const categories = useProgrammeCategories().data?.categories ?? [];
  const [editing, setEditing] = useState(false);

  return (
    <PageContainer className="gap-0">
      <BackLink fallback="/admin/teachers">Back to Teachers</BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={6} />}>
          {({ teacher: t }) => {
            const category = categories.find((c) => c.key === t.programme);
            const type = teacherTypeByKey(t.type);
            const assignments = [...t.sectionCourses].sort(
              (a, b) => a.course.code.localeCompare(b.course.code) || a.section.batch.localeCompare(b.section.batch) || a.section.label.localeCompare(b.section.label),
            );
            const courseCount = new Set(assignments.map((a) => a.course.id)).size;
            const credits = [...new Map(assignments.map((a) => [a.course.id, a.course.creditHours])).values()].reduce((s, n) => s + n, 0);
            const initials = t.name
              .replace(/^(Dr|Mr|Ms|Mrs|Prof|Capt|Chef)\.?\s+/i, "")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <>
                <DetailHeader
                  tile={initials}
                  color={category?.color}
                  bg={category?.bg}
                  title={t.name}
                  subtitle={
                    <>
                      {t.qualification}
                      {category ? <> · {category.label}</> : null} · {type.label}
                      {payRateText(t) ? <> · {payRateText(t)}</> : null}
                    </>
                  }
                  meta={
                    <>
                      <span>
                        <Mail aria-hidden /> {t.email}
                      </span>
                      <span>
                        <Phone aria-hidden /> {t.phone}
                      </span>
                      <span>
                        <BookOpen aria-hidden /> {courseCount} courses · {assignments.length} sections · {credits} CR
                      </span>
                    </>
                  }
                  action={
                    <ClassicButton variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="size-[14px]" /> Edit
                    </ClassicButton>
                  }
                />

                {t.user?.status !== "ACTIVE" ? (
                  <p className="-mt-3 mb-5">
                    <StatusPill tone={t.user ? "muted" : "warning"}>
                      {t.user ? `Login ${t.user.status.toLowerCase()}` : "No login"}
                    </StatusPill>
                  </p>
                ) : null}

                <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 max-[400px]:grid-cols-1">
                  <DetailsSection title="Personal Information">
                    <DetailsField label="Full Name" value={t.name} />
                    <DetailsField label="CNIC" value={t.cnic} />
                    <DetailsField label="Qualification" value={t.qualification} />
                    <DetailsField label="Programme" value={category?.label} />
                  </DetailsSection>
                  <DetailsSection title="Employment">
                    <DetailsField
                      label="Teacher Type"
                      value={
                        <ColorPill color={type.color} bg={type.bg}>
                          {type.label}
                        </ColorPill>
                      }
                    />
                    <DetailsField label={t.type === "VISITING" ? "Rate" : "Salary"} value={payRateText(t) ?? "Not set"} />
                  </DetailsSection>
                  <DetailsSection title="Contact">
                    <DetailsField label="Email" value={t.email} />
                    <DetailsField label="Phone" value={t.phone} />
                    <DetailsField label="Address" value={t.address} wide />
                  </DetailsSection>
                  <DetailsSection title="Guardian">
                    <DetailsField label="Guardian Name" value={t.guardianName} />
                    <DetailsField label="Guardian Contact" value={t.guardianContact} />
                    <DetailsField label="Guardian CNIC" value={t.guardianCnic} />
                  </DetailsSection>
                </div>

                <BlockHeading
                  className="mb-[0.9rem]"
                  meta={assignments.length > 0 ? ` · ${courseCount} course${courseCount === 1 ? "" : "s"} in ${assignments.length} section${assignments.length === 1 ? "" : "s"}` : null}
                >
                  Teaching Assignments
                </BlockHeading>
                {assignments.length === 0 ? (
                  <TableEmpty icon={Briefcase}>No course assigned yet. Assign courses from the Assign Teacher page or a section&apos;s page.</TableEmpty>
                ) : (
                  <TableCard>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead>Diploma</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Credits</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((sc) => {
                          const dept = sc.section.department;
                          return (
                            <TableRow key={sc.id} className="[&>td]:whitespace-normal">
                              <TableCell>
                                <NavLink href={`/admin/courses/${sc.course.id}`} className="gap-[0.6rem]">
                                  <span
                                    className="shrink-0 rounded-md px-[0.55rem] py-[0.3rem] text-[0.72rem] font-bold tracking-[0.03em]"
                                    style={{ color: dept.color, background: dept.bg }}
                                  >
                                    {sc.course.code}
                                  </span>
                                  <span className="font-semibold text-foreground">{sc.course.name}</span>
                                </NavLink>
                              </TableCell>
                              <TableCell>
                                <NavLink href={`/admin/diplomas/${dept.id}`}>{dept.code}</NavLink>
                              </TableCell>
                              <TableCell className="!whitespace-nowrap">
                                <NavLink href={`/admin/sections/${sc.section.id}`}>
                                  Section {sc.section.label} · Batch {sc.section.batch}
                                </NavLink>
                              </TableCell>
                              <TableCell className="!whitespace-nowrap">
                                <Clock className="inline size-3 align-[-1px]" aria-hidden /> {sc.course.creditHours} CR
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableCard>
                )}

                {editing ? <ClassicTeacherModal teacher={t} onClose={() => setEditing(false)} /> : null}
              </>
            );
          }}
        </QueryView>
      </div>
    </PageContainer>
  );
}
