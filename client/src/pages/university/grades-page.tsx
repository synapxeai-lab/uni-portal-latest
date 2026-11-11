import { useState } from "react";
import { Award, CalendarClock, EyeOff, Sparkles } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useSession } from "@/lib/auth";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { FormDialog } from "@/features/academics/components/form-dialog";
import { runAction, TableCard } from "@/features/academics/components/ui";

interface GradesOverview {
  offerings: {
    sectionId: number;
    courseId: number;
    course: { id: number; code: string; name: string };
    section: { label: string; batch: string };
    teacher: { name: string } | null;
    classroomId: string | null;
    students: number;
    generated: number;
  }[];
  releases: {
    courseId: number;
    course: { code: string; name: string };
    students: number;
    visibleFrom: Date | null;
    visibleTo: Date | null;
    generatedAt: Date | null;
  }[];
}

const when = (date: Date | null) => (date ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/**
 * Generate grades (a snapshot of each student's current grade) and choose when
 * students see them. Teachers act on their own courses, admins on all.
 */
export default function GradesPage() {
  const isAdmin = useSession().data?.user.role === "ADMIN";
  const query = useUniversityQuery<GradesOverview>("/grades");
  const [generateFor, setGenerateFor] = useState<{ courseId: number | null; label: string } | null>(null);
  const [rescheduling, setRescheduling] = useState<GradesOverview["releases"][number] | null>(null);
  const [unpublishing, setUnpublishing] = useState<GradesOverview["releases"][number] | null>(null);

  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ offerings, releases }) => {
        const courses = [...new Map(offerings.map((o) => [o.courseId, o.course])).values()];
        return (
          <PageContainer>
            <SectionHeader
              title="Grades"
              description="Students only see a grade once it's generated here and its release time has come."
              breadcrumbs={[{ label: "Grades" }]}
              actions={
                isAdmin && courses.length > 0 ? (
                  <Button onClick={() => setGenerateFor({ courseId: null, label: "every course" })}>
                    <Sparkles /> Generate all grades
                  </Button>
                ) : undefined
              }
            />

            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-base font-bold">Released grades</h2>
              {releases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No grades generated yet.</p>
              ) : (
                <TableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Students</TableHead>
                        <TableHead>Visible from</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead className="w-0" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {releases.map((r) => {
                        const live = r.visibleFrom && r.visibleFrom <= new Date();
                        return (
                          <TableRow key={r.courseId}>
                            <TableCell>
                              <span className="font-mono text-xs">{r.course.code}</span> {r.course.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{r.students}</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-2">
                                {when(r.visibleFrom)}
                                <Badge variant={live ? "success" : "info"}>{live ? "Visible" : "Scheduled"}</Badge>
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{when(r.generatedAt)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" aria-label="Change release time" onClick={() => setRescheduling(r)}>
                                  <CalendarClock />
                                </Button>
                                <Button size="sm" variant="ghost" aria-label="Unpublish" onClick={() => setUnpublishing(r)}>
                                  <EyeOff />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableCard>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-base font-bold">{isAdmin ? "All course sections" : "Your course sections"}</h2>
              {offerings.length === 0 ? (
                <EmptyState icon={Award} title="No course sections" />
              ) : (
                <TableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Section</TableHead>
                        {isAdmin ? <TableHead>Teacher</TableHead> : null}
                        <TableHead className="text-right">Students</TableHead>
                        <TableHead className="text-right">Generated</TableHead>
                        <TableHead className="w-0" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offerings.map((o) => (
                        <TableRow key={`${o.sectionId}-${o.courseId}`}>
                          <TableCell>
                            <span className="font-mono text-xs">{o.course.code}</span> {o.course.name}
                          </TableCell>
                          <TableCell className="text-sm">
                            {o.section.batch}-{o.section.label}
                          </TableCell>
                          {isAdmin ? <TableCell className="text-sm">{o.teacher?.name ?? "-"}</TableCell> : null}
                          <TableCell className="text-right tabular-nums">{o.students}</TableCell>
                          <TableCell className="text-right tabular-nums">{o.generated}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {o.classroomId ? (
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/classes/${o.classroomId}/marks`}>Marks</Link>
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={o.students === 0}
                                onClick={() => setGenerateFor({ courseId: o.courseId, label: o.course.code })}
                              >
                                Generate
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

            <FormDialog
              open={generateFor !== null}
              onOpenChange={(open) => !open && setGenerateFor(null)}
              title={`Generate grades for ${generateFor?.label}`}
              description="Takes each student's current grade (with overrides). Students with no marks yet are skipped. Generating again replaces the snapshot."
              fields={[{ name: "visibleFrom", label: "Students see them from", type: "date", required: true }]}
              initialValues={{ visibleFrom: new Date().toISOString().slice(0, 10) }}
              submitLabel="Generate"
              onSubmit={(values) =>
                universityAction("post", "/grades/generate", { courseId: generateFor!.courseId, visibleFrom: values.visibleFrom })
              }
            />
            <FormDialog
              open={rescheduling !== null}
              onOpenChange={(open) => !open && setRescheduling(null)}
              title={`Release time for ${rescheduling?.course.code}`}
              fields={[{ name: "visibleFrom", label: "Students see them from", type: "text", required: true, hint: "Date and time, e.g. 2026-12-20T09:00" }]}
              initialValues={rescheduling?.visibleFrom ? { visibleFrom: localInput(rescheduling.visibleFrom) } : undefined}
              onSubmit={(values) => universityAction("put", `/grades/releases/${rescheduling!.courseId}`, values)}
            />
            <ConfirmDialog
              open={unpublishing !== null}
              onOpenChange={(open) => !open && setUnpublishing(null)}
              title={`Unpublish grades for ${unpublishing?.course.code}?`}
              description="Students stop seeing these grades until they're generated again."
              confirmLabel="Unpublish"
              destructive
              onConfirm={async () => {
                if (!unpublishing) return;
                await runAction(universityAction("delete", `/grades/releases/${unpublishing.courseId}`));
                setUnpublishing(null);
              }}
            />
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
