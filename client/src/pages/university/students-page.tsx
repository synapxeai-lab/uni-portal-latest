import { useState } from "react";
import { GraduationCap, Plus } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  queryString,
  useBatches,
  useProgrammeCategories,
  useProgrammeLookup,
  useUniversityQuery,
} from "@/features/academics/api";
import {
  LoginCreatedDialog,
  StudentDialog,
  type CreatedLogin,
  type StudentRecord,
} from "@/features/academics/components/people-dialogs";
import { TableCard } from "@/features/academics/components/ui";

/** Students, filterable by programme and batch; each opens their record. */
export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("");
  const [batch, setBatch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const query = useUniversityQuery<{ students: StudentRecord[] }>(
    `/students${queryString({ search: debounced, programme, batch })}`,
    { keepPrevious: true },
  );
  const categories = useProgrammeCategories().data?.categories ?? [];
  const batches = useBatches().data?.batches ?? [];
  const programmeOf = useProgrammeLookup();
  const [adding, setAdding] = useState(false);
  const [login, setLogin] = useState<CreatedLogin | null>(null);

  return (
    <PageContainer>
      <SectionHeader
        title="Students"
        description="Each student belongs to a programme, batch and section, and has a login."
        breadcrumbs={[{ label: "Students" }]}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add student
          </Button>
        }
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Search name, email or roll no." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
        <Select value={programme} onChange={(e) => setProgramme(e.target.value)} aria-label="Programme">
          <option value="">All programmes</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Batch">
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              Batch {b}
            </option>
          ))}
        </Select>
      </div>
      <QueryView query={query} loading={<AdminLoading />}>
        {({ students }) =>
          students.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No students found" />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll no.</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Batch / section</TableHead>
                    <TableHead>Current diploma</TableHead>
                    <TableHead>Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono text-xs">{student.rollNo}</TableCell>
                      <TableCell>
                        <Link href={`/admin/students/${student.id}`} className="flex flex-col">
                          <span className="font-semibold hover:underline">{student.name}</span>
                          <span className="text-xs text-muted-foreground">{student.email}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{programmeOf(student.programme)?.label ?? student.programme}</TableCell>
                      <TableCell className="text-sm">
                        {student.batch} · {student.section}
                      </TableCell>
                      <TableCell className="text-sm">{student.currentDiploma?.code ?? "-"}</TableCell>
                      <TableCell>
                        {student.user ? (
                          <Badge variant={student.user.status === "ACTIVE" ? "success" : "secondary"}>
                            {student.user.status === "ACTIVE" ? "Active" : student.user.status.toLowerCase()}
                          </Badge>
                        ) : (
                          <Badge variant="warning">No login</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )
        }
      </QueryView>
      <StudentDialog
        open={adding}
        onOpenChange={setAdding}
        categories={categories}
        batches={batches}
        onLoginCreated={setLogin}
      />
      <LoginCreatedDialog login={login} onClose={() => setLogin(null)} />
    </PageContainer>
  );
}
