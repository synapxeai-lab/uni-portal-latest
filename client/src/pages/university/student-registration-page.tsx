import { useState } from "react";
import { CalendarX, Check, ClipboardList } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { ordinal, runAction, TableCard } from "@/features/academics/components/ui";

interface OfferedCourse {
  id: number;
  code: string;
  name: string;
  creditHours: number;
  department: { code: string; semester: number };
  sections: { id: number; label: string; teacher: { name: string } | null }[];
  defaultSectionId: number | null;
  registered: boolean;
  registeredSectionId: number | null;
  missed: boolean;
  failed: boolean;
}

interface MyRegistration {
  registrationOpen: boolean;
  registration?: { semester: string; year: number; endDate: Date };
  semester?: number | null;
  diploma?: { name: string; code: string } | null;
  message?: string | null;
  gradesPending?: boolean;
  courses: OfferedCourse[];
  creditLimit?: number;
  creditsUsed?: number;
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** A student's course registration for the open period. */
export default function StudentRegistrationPage() {
  const query = useUniversityQuery<MyRegistration>("/my/registration");
  const [sectionFor, setSectionFor] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<number | null>(null);

  return (
    <QueryView query={query} loading={<AppLoading />}>
      {(page) => {
        const used = page.creditsUsed ?? 0;
        const limit = page.creditLimit ?? 0;
        return (
          <PageContainer>
            <SectionHeader
              title="Course registration"
              description={
                page.registration
                  ? `${titleCase(page.registration.semester)} ${page.registration.year} · closes ${page.registration.endDate.toLocaleDateString(undefined, { dateStyle: "medium" })}`
                  : undefined
              }
              breadcrumbs={[{ label: "Registration" }]}
            />
            {!page.registrationOpen ? (
              <EmptyState icon={CalendarX} title="Registration is closed" description={page.message ?? undefined} />
            ) : (
              <>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex flex-col">
                    <span className="font-semibold">{page.diploma?.name ?? "No diploma this term"}</span>
                    <span className="text-xs text-muted-foreground">
                      {page.semester ? `${ordinal(page.semester)} semester` : ""}
                    </span>
                  </div>
                  <div className="flex min-w-48 flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Credits registered: <span className="font-semibold text-foreground">{used}</span> / {limit}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-gold" style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%` }} />
                    </div>
                  </div>
                </Card>
                {page.message ? (
                  <EmptyState icon={ClipboardList} title={page.message} />
                ) : (
                  <TableCard>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="min-w-48">Section</TableHead>
                          <TableHead className="w-0" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {page.courses.map((course) => {
                          const selected = sectionFor[course.id] ?? course.registeredSectionId ?? course.defaultSectionId ?? "";
                          const tooMany = used + course.creditHours > limit;
                          return (
                            <TableRow key={course.id}>
                              <TableCell>
                                <span className="flex flex-col">
                                  <span className="font-semibold">
                                    {course.name}{" "}
                                    {course.failed ? (
                                      <Badge variant="destructive">Retake</Badge>
                                    ) : course.missed ? (
                                      <Badge variant="warning">Missed · {ordinal(course.department.semester)} sem</Badge>
                                    ) : null}
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground">{course.code}</span>
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{course.creditHours}</TableCell>
                              <TableCell>
                                <Select
                                  aria-label={`Section for ${course.code}`}
                                  value={selected}
                                  disabled={course.registered}
                                  onChange={(e) => setSectionFor((current) => ({ ...current, [course.id]: Number(e.target.value) }))}
                                >
                                  {course.sections.map((section) => (
                                    <option key={section.id} value={section.id}>
                                      Section {section.label}
                                      {section.teacher ? ` · ${section.teacher.name}` : ""}
                                    </option>
                                  ))}
                                </Select>
                              </TableCell>
                              <TableCell>
                                {course.registered ? (
                                  <Badge variant="success" className="gap-1">
                                    <Check className="h-3 w-3" /> Registered
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled={busy !== null || !selected || tooMany}
                                    title={tooMany ? "This would exceed your credit limit" : undefined}
                                    onClick={async () => {
                                      setBusy(course.id);
                                      await runAction(
                                        universityAction("post", "/my/registration", { courseId: course.id, sectionId: Number(selected) }),
                                      );
                                      setBusy(null);
                                    }}
                                  >
                                    Register
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableCard>
                )}
              </>
            )}
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
