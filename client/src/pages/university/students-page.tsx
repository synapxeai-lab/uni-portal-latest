import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, User } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { ListSkeleton } from "@/components/states/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ClassicButton,
  ClassicConfirm,
  FilterPills,
  FilterPillsRow,
  RowButton,
  SearchBox,
  StatusPill,
  TableEmpty,
  type FilterOption,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { queryString, universityAction, useBatches, useProgrammeCategories, useUniversityQuery } from "@/features/academics/api";
import { ClassicStudentModal } from "@/features/academics/components/classic-student-modal";
import { LoginCreatedDialog, type CreatedLogin, type StudentRecord } from "@/features/academics/components/people-dialogs";
import { ordinal, runAction, TableCard } from "@/features/academics/components/ui";

/**
 * Students (admin): an exact replica of the old University Portal's Students
 * page - search, programme pills with counts, and one clickable row per
 * student with their diploma, batch, contact, CNIC, education and guardian.
 */

// "Tourism & Hospitality Management Programmes" -> "Tourism & Hospitality Management".
const shortProgrammeLabel = (label: string) => label.replace(/ Programmes?$/i, "");
// .td-date: muted, small and never wrapping; every other cell wraps like the old table.
const muted = "whitespace-nowrap text-[0.8rem] text-muted-foreground";

/** A student without an active login can't sign in: flagged under their roll no. */
function LoginFlag({ student }: { student: StudentRecord }) {
  if (student.user?.status === "ACTIVE") return null;
  return (
    <span className="mt-1 block w-fit">
      <StatusPill tone={student.user ? "muted" : "warning"}>{student.user ? student.user.status.toLowerCase() : "No login"}</StatusPill>
    </span>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("");
  const [batch, setBatch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = useUniversityQuery<{ students: StudentRecord[] }>(`/students${queryString({ search: debounced })}`, {
    keepPrevious: true,
  });
  const categories = useProgrammeCategories().data?.categories ?? [];
  const batches = useBatches().data?.batches ?? [];
  const students = useMemo(() => query.data?.students ?? [], [query.data]);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StudentRecord | null>(null);
  const [deleting, setDeleting] = useState<StudentRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [login, setLogin] = useState<CreatedLogin | null>(null);

  // Each pill group counts the students the other group lets through.
  const inBatch = batch ? students.filter((s) => s.batch === batch) : students;
  const inProgramme = programme ? students.filter((s) => s.programme === programme) : students;
  const filtered = programme ? inBatch.filter((s) => s.programme === programme) : inBatch;
  const programmeOptions: FilterOption[] = [
    { value: "", label: "All", count: inBatch.length },
    ...categories.map((c) => ({
      value: c.key,
      label: shortProgrammeLabel(c.label),
      count: inBatch.filter((s) => s.programme === c.key).length,
    })),
  ];
  const batchOptions: FilterOption[] = [
    { value: "", label: "All", count: inProgramme.length },
    ...batches.map((b) => ({ value: b, label: b, count: inProgramme.filter((s) => s.batch === b).length })),
  ];

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    await runAction(universityAction("delete", `/students/${deleting.id}`), `Student ${deleting.name} deleted.`);
    setPending(false);
    setDeleting(null);
  }

  return (
    <PageContainer className="gap-4">
      <SectionHeader
        title="Students"
        description={`${filtered.length} student${filtered.length === 1 ? "" : "s"}`}
        breadcrumbs={[{ label: "Students" }]}
        actions={
          <ClassicButton onClick={() => setAdding(true)} className="shrink-0">
            <Plus className="size-4" /> Add Student
          </ClassicButton>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by name, email, or roll no…" />
      </div>

      <FilterPillsRow>
        <FilterPills label="Programme" options={programmeOptions} value={programme} onChange={setProgramme} />
        <FilterPills label="Batch" options={batchOptions} value={batch} onChange={setBatch} />
      </FilterPillsRow>

      <QueryView query={query} loading={<ListSkeleton rows={8} />}>
        {() => (
          <TableCard className={cn(query.isPlaceholderData && "opacity-60 transition-opacity")}>
            {filtered.length === 0 ? (
              <TableEmpty icon={User}>
                {students.length === 0 && !search ? "No students added yet." : "No students match your filters."}
              </TableEmpty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Current Diploma</TableHead>
                    <TableHead>Batch / Section</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>CNIC</TableHead>
                    <TableHead>Last Qualification</TableHead>
                    <TableHead>Guardian</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, i) => (
                    <TableRow
                      key={s.id}
                      title="View details"
                      className="cursor-pointer [&>td]:whitespace-normal"
                      onClick={() => router.push(`/admin/students/${s.id}`)}
                    >
                      <TableCell className={cn(muted, "w-10")}>{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{s.name}</div>
                        <div className={muted}>{s.rollNo}</div>
                        <LoginFlag student={s} />
                      </TableCell>
                      <TableCell>
                        {s.currentDiploma ? (
                          <>
                            <span
                              className="inline-block max-w-full whitespace-nowrap rounded-xl px-2 py-[0.12rem] text-[0.68rem] font-bold"
                              style={{ color: s.currentDiploma.color, background: s.currentDiploma.bg }}
                            >
                              {s.currentDiploma.code}
                            </span>
                            <div className={muted}>{ordinal(s.currentDiploma.semester)} Semester</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="!whitespace-nowrap">
                        <div>Batch {s.batch}</div>
                        <div className={muted}>Section {s.section}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate text-mid-foreground">{s.email}</div>
                        <div className={muted}>{s.phone}</div>
                      </TableCell>
                      <TableCell className={cn(muted, "!whitespace-nowrap")}>{s.cnic}</TableCell>
                      <TableCell>
                        {s.lastQualification ? (
                          <>
                            <div>{s.lastQualification}</div>
                            <div className={muted}>{[s.grade, s.passingYear, s.university].filter(Boolean).join(" · ")}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          {s.guardianName}
                          {s.guardianRelationship ? <span className={muted}> ({s.guardianRelationship})</span> : null}
                        </div>
                        <div className={muted}>{s.guardianContact}</div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-[0.4rem]">
                          <RowButton kind="edit" icon={Pencil} label="Edit" title="Edit student" onClick={() => setEditing(s)} />
                          <RowButton kind="delete" icon={Trash2} label="Delete" title="Delete student" onClick={() => setDeleting(s)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCard>
        )}
      </QueryView>

      {adding ? <ClassicStudentModal onClose={() => setAdding(false)} onLoginCreated={setLogin} /> : null}
      {editing ? <ClassicStudentModal student={editing} onClose={() => setEditing(null)} /> : null}
      <LoginCreatedDialog login={login} onClose={() => setLogin(null)} />
      <ClassicConfirm
        open={deleting !== null}
        title="Delete Student"
        message={`Are you sure you want to delete "${deleting?.name}"? This action cannot be undone.`}
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
