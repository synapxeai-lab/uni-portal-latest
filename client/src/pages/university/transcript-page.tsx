import { FileText, Printer } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProgrammeLookup, useUniversityQuery } from "@/features/academics/api";
import { Fact, ordinal, TableCard } from "@/features/academics/components/ui";

interface Transcript {
  student: { name: string; rollNo: string; batch: string; programme: string };
  semesters: {
    semester: string;
    year: number;
    semesterNumber: number | null;
    diploma: { name: string; code: string };
    creditHours: number;
    gpa: number | null;
    courses: { enrollmentId: number; code: string; name: string; creditHours: number; grade: string | null; gradePoints: number | null }[];
  }[];
  totalCreditHours: number;
  cgpa: number | null;
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const gpa = (value: number | null) => (value === null ? "-" : value.toFixed(2));

/** A student's transcript: released grades and GPA per semester, and the CGPA. */
export default function TranscriptPage() {
  const query = useUniversityQuery<Transcript>("/my/transcript");
  const programmeOf = useProgrammeLookup();
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ student, semesters, totalCreditHours, cgpa }) => (
        <PageContainer>
          <SectionHeader
            title="Transcript"
            description="Only released grades are shown. GPA is on the HEC 4.0 scale, weighted by credit hours."
            breadcrumbs={[{ label: "Transcript" }]}
            actions={
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> Print
              </Button>
            }
          />
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
            <Fact label="Student">{student.name}</Fact>
            <Fact label="Roll no.">{student.rollNo}</Fact>
            <Fact label="Programme">{programmeOf(student.programme)?.label ?? student.programme}</Fact>
            <Fact label="Credit hours">{totalCreditHours}</Fact>
            <Fact label="CGPA">{gpa(cgpa)}</Fact>
          </Card>
          {semesters.length === 0 ? (
            <EmptyState icon={FileText} title="No courses yet" />
          ) : (
            semesters.map((s) => (
              <div key={`${s.semester}-${s.year}`} className="flex flex-col gap-2">
                <h2 className="font-heading text-base font-bold">
                  {titleCase(s.semester)} {s.year}
                  {s.semesterNumber ? ` · ${ordinal(s.semesterNumber)} semester` : ""} · {s.diploma.name}
                </h2>
                <TableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">Grade</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.courses.map((c) => (
                        <TableRow key={c.enrollmentId}>
                          <TableCell className="font-mono text-xs">{c.code}</TableCell>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.creditHours}</TableCell>
                          <TableCell className="text-right font-semibold">{c.grade ?? <span className="font-normal text-muted-foreground">Pending</span>}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.gradePoints?.toFixed(2) ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} className="text-right font-semibold">
                          Semester GPA
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.creditHours}</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-bold tabular-nums">{gpa(s.gpa)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableCard>
              </div>
            ))
          )}
        </PageContainer>
      )}
    </QueryView>
  );
}
