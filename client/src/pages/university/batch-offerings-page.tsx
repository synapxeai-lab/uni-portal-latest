import { useState } from "react";
import { useParams } from "react-router";
import { ExternalLink, Minus, Plus } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { ordinal, runAction, TableCard } from "@/features/academics/components/ui";

interface BatchOfferings {
  department: { id: number; name: string; code: string };
  batch: string;
  sections: { id: number; label: string }[];
  courses: {
    id: number;
    code: string;
    name: string;
    creditHours: number;
    department: { code: string; semester: number };
    ownDiploma: boolean;
    offeredTo: { sectionId: number; label: string; teacher: { name: string } | null; classroomId: string | null }[];
  }[];
}

/** One diploma's batch: every course of the programme, and which sections it's offered to. */
export default function BatchOfferingsPage() {
  const params = useParams();
  const departmentId = Number(params.departmentId);
  const batch = decodeURIComponent(params.batch ?? "");
  const query = useUniversityQuery<BatchOfferings>(`/offerings/${departmentId}/${encodeURIComponent(batch)}`);
  const [busy, setBusy] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function toggle(courseId: number, offer: boolean) {
    setBusy(courseId);
    await runAction(universityAction("post", offer ? "/offerings" : "/offerings/remove", { departmentId, courseId, batch }));
    setBusy(null);
  }

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ department, sections, courses }) => {
        const visible = showAll ? courses : courses.filter((c) => c.ownDiploma || c.offeredTo.length > 0);
        return (
          <PageContainer>
            <SectionHeader
              title={`Batch ${batch} · ${department.name}`}
              description={`Sections ${sections.map((s) => s.label).join(", ") || "-"}. A course is offered to every section of the batch at once.`}
              breadcrumbs={[{ label: "Offer courses", href: "/admin/offerings" }, { label: `${department.code} ${batch}` }]}
              actions={
                <Button variant="outline" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Only this diploma's courses" : "Show all programme courses"}
                </Button>
              }
            />
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Sections (teacher)</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((course) => {
                    const offered = course.offeredTo.length > 0;
                    return (
                      <TableRow key={course.id}>
                        <TableCell>
                          <span className="font-mono text-xs">{course.code}</span>{" "}
                          <Link href={`/admin/courses/${course.id}`} className="font-semibold">
                            {course.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {course.department.code} · {ordinal(course.department.semester)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{course.creditHours}</TableCell>
                        <TableCell>
                          {offered ? (
                            <div className="flex flex-wrap gap-1.5">
                              {course.offeredTo.map((link) => (
                                <Badge key={link.sectionId} variant="outline" className="gap-1">
                                  {link.label}: {link.teacher?.name ?? "no teacher"}
                                  {link.classroomId ? (
                                    <Link href={`/classes/${link.classroomId}`} aria-label={`Open the section ${link.label} classroom`}>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  ) : null}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not offered</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={offered ? "outline" : "default"}
                            disabled={busy === course.id}
                            onClick={() => toggle(course.id, !offered)}
                          >
                            {offered ? (
                              <>
                                <Minus /> Withdraw
                              </>
                            ) : (
                              <>
                                <Plus /> Offer
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableCard>
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
