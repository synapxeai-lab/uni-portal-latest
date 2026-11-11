import { useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  queryString,
  universityAction,
  useProgrammeCategories,
  useProgrammeLookup,
  useUniversityQuery,
} from "@/features/academics/api";
import {
  LoginCreatedDialog,
  TeacherDialog,
  type CreatedLogin,
  type TeacherRecord,
} from "@/features/academics/components/people-dialogs";
import { formatRs, runAction, TableCard } from "@/features/academics/components/ui";

/** Teachers: profile, programme, pay type and what they teach. */
export default function TeachersPage() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const query = useUniversityQuery<{ teachers: TeacherRecord[] }>(`/teachers${queryString({ search: debounced })}`, {
    keepPrevious: true,
  });
  const categories = useProgrammeCategories().data?.categories ?? [];
  const programmeOf = useProgrammeLookup();
  const [editing, setEditing] = useState<TeacherRecord | "new" | null>(null);
  const [deleting, setDeleting] = useState<TeacherRecord | null>(null);
  const [login, setLogin] = useState<CreatedLogin | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <PageContainer>
      <SectionHeader
        title="Teachers"
        description="Every teacher has a login; what they teach is set from Offer courses."
        breadcrumbs={[{ label: "Teachers" }]}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add teacher
          </Button>
        }
      />
      <Input
        className="sm:max-w-sm"
        placeholder="Search name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search teachers"
      />
      <QueryView query={query} loading={<AdminLoading />}>
        {({ teachers }) =>
          teachers.length === 0 ? (
            <EmptyState icon={UserRound} title="No teachers found" />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Pay</TableHead>
                    <TableHead className="text-right">Classes</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="font-semibold">{teacher.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {teacher.email} · {teacher.phone}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{programmeOf(teacher.programme)?.label ?? teacher.programme}</TableCell>
                      <TableCell className="text-sm">
                        {teacher.type === "VISITING"
                          ? `Visiting · ${formatRs(teacher.ratePerCreditHour)}/credit hr`
                          : `Permanent · ${formatRs(teacher.salary)}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{teacher.sectionCourses.length}</TableCell>
                      <TableCell>
                        {teacher.user ? (
                          <Badge variant={teacher.user.status === "ACTIVE" ? "success" : "secondary"}>
                            {teacher.user.status === "ACTIVE" ? "Active" : teacher.user.status.toLowerCase()}
                          </Badge>
                        ) : (
                          <Badge variant="warning">No login</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${teacher.name}`} onClick={() => setEditing(teacher)}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${teacher.name}`} onClick={() => setDeleting(teacher)}>
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

      <TeacherDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        teacher={editing === "new" || editing === null ? undefined : editing}
        categories={categories}
        onLoginCreated={setLogin}
      />
      <LoginCreatedDialog login={login} onClose={() => setLogin(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Their classes become unassigned and their login is archived (it can be restored from Users)."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          await runAction(universityAction("delete", `/teachers/${deleting.id}`));
          setPending(false);
          setDeleting(null);
        }}
      />
    </PageContainer>
  );
}
