import { useState } from "react";
import { useParams } from "react-router";
import { Copy, ExternalLink, Pencil, Plus, Receipt, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useCourse, useDepartments } from "@/features/academics/api";
import { CopyCourseDialog, CourseDialog, ExtraFeeDialog } from "@/features/academics/components/structure-dialogs";
import { SchemeDialog } from "@/features/academics/components/scheme-dialog";
import { Fact, formatRs, ordinal, runAction, TableCard } from "@/features/academics/components/ui";
import type { ExtraFee } from "@/features/academics/types";

/** One course: details, extra fees, assessment scheme and the sections it's offered to. */
export default function CoursePage() {
  const id = Number(useParams().id);
  const query = useCourse(id);
  const departments = useDepartments().data?.departments ?? [];
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [editingScheme, setEditingScheme] = useState(false);
  const [feeDialog, setFeeDialog] = useState<ExtraFee | "new" | null>(null);

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ course }) => (
        <PageContainer>
          <SectionHeader
            title={`${course.code} · ${course.name}`}
            breadcrumbs={[
              { label: "Courses", href: "/admin/courses" },
              { label: course.department.code, href: `/admin/diplomas/${course.departmentId}` },
              { label: course.code },
            ]}
            actions={
              <>
                <Button variant="outline" onClick={() => setCopying(true)}>
                  <Copy /> Add to diploma
                </Button>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Edit
                </Button>
              </>
            }
          />

          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Diploma">{course.department.name}</Fact>
            <Fact label="Semester">{ordinal(course.department.semester)}</Fact>
            <Fact label="Credit hours">{course.creditHours}</Fact>
            <Fact label="Fee">{formatRs(course.fee)}</Fact>
            <Fact label="Total fee">
              {formatRs(course.totalFee)}
              {course.discountRate > 0 ? <span className="ml-1 text-xs text-muted-foreground">({course.discountRate}% off)</span> : null}
            </Fact>
            <Fact label="Theory / practical">
              {course.theoryPercent}% / {100 - course.theoryPercent}%
            </Fact>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Extra fees</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setFeeDialog("new")}>
                  <Plus /> Add fee
                </Button>
              </CardHeader>
              <CardContent>
                {course.extraFees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No extra fees. Students pay the course fee only.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {course.extraFees.map((fee) => (
                      <li key={fee.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-sm">{fee.name}</span>
                        <span className="flex items-center gap-1">
                          <span className="text-sm font-semibold tabular-nums">{formatRs(fee.amount)}</span>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${fee.name}`} onClick={() => setFeeDialog(fee)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${fee.name}`}
                            onClick={() => runAction(universityAction("delete", `/courses/${course.id}/fees/${fee.id}`))}
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Assessment scheme</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setEditingScheme(true)}>
                  <Pencil /> Edit
                </Button>
              </CardHeader>
              <CardContent>
                {course.assessmentScheme.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No scheme yet. It decides which assessments teachers mark and how much each counts.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {course.assessmentScheme.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                        <span>
                          {entry.type}{" "}
                          <Badge variant="outline" className="ml-1">
                            {entry.component === "THEORY" ? "Theory" : "Practical"}
                          </Badge>
                        </span>
                        <span className="font-semibold tabular-nums">{entry.weightage}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-base font-bold">Offered to</h2>
            {course.sectionLinks.length === 0 ? (
              <EmptyState icon={Receipt} title="Not offered yet" description="Offer it to a batch's sections from Offer courses." />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Classroom</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {course.sectionLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>{link.section.batch}</TableCell>
                        <TableCell>
                          <Link href={`/admin/sections/${link.section.id}`} >
                            Section {link.section.label}
                          </Link>
                        </TableCell>
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

          <SchemeDialog open={editingScheme} onOpenChange={setEditingScheme} course={course} />
          <CourseDialog open={editing} onOpenChange={setEditing} course={course} departments={departments} />
          {copying ? <CopyCourseDialog open onOpenChange={setCopying} course={course} departments={departments} /> : null}
          <ExtraFeeDialog
            open={feeDialog !== null}
            onOpenChange={(open) => !open && setFeeDialog(null)}
            courseId={course.id}
            fee={feeDialog === "new" || feeDialog === null ? undefined : feeDialog}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
