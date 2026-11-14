import { useMemo, useState } from "react";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ClassicButton,
  ClassicConfirm,
  ClassicPageHeader,
  ColorPill,
  DetailsModal,
  FilterPills,
  RowButton,
  SearchBox,
  StatusPill,
  TableEmpty,
  type FilterOption,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { queryString, universityAction, useProgrammeCategories, useUniversityQuery } from "@/features/academics/api";
import { ClassicTeacherModal, payRateText, teacherTypeByKey } from "@/features/academics/components/classic-teacher-modal";
import { LoginCreatedDialog, type CreatedLogin, type TeacherRecord } from "@/features/academics/components/people-dialogs";
import { runAction, TableCard } from "@/features/academics/components/ui";
import type { ProgrammeCategory } from "@/features/academics/types";

/**
 * Teachers (admin): an exact replica of the old University Portal's Teachers
 * page - search, programme pills with counts, and a table whose rows open the
 * teacher's details.
 */

const shortProgrammeLabel = (label: string) => label.replace(/ Programmes?$/i, "");
const muted = "whitespace-nowrap text-[0.8rem] text-muted-foreground";

function ProgrammeBadge({ category, short }: { category?: ProgrammeCategory; short?: boolean }) {
  if (!category) return null;
  return (
    <ColorPill color={category.color} bg={category.bg}>
      {short ? shortProgrammeLabel(category.label) : category.label}
    </ColorPill>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = teacherTypeByKey(type);
  return (
    <ColorPill color={t.color} bg={t.bg}>
      {t.label}
    </ColorPill>
  );
}

/** A teacher without an active login can't sign in: flagged under their name. */
function LoginFlag({ teacher }: { teacher: TeacherRecord }) {
  if (teacher.user?.status === "ACTIVE") return null;
  return (
    <span className="mt-1 block w-fit">
      <StatusPill tone={teacher.user ? "muted" : "warning"}>{teacher.user ? teacher.user.status.toLowerCase() : "No login"}</StatusPill>
    </span>
  );
}

function TeacherDetails({
  teacher: t,
  category,
  onEdit,
  onClose,
}: {
  teacher: TeacherRecord;
  category?: ProgrammeCategory;
  onEdit: () => void;
  onClose: () => void;
}) {
  const assignments = t.sectionCourses;
  return (
    <DetailsModal
      title={t.name}
      subtitle={t.qualification}
      badge={<ProgrammeBadge category={category} />}
      sections={[
        {
          heading: "Personal Information",
          fields: [
            ["Full Name", t.name],
            ["CNIC", t.cnic],
            ["Qualification", t.qualification],
            ["Programme", category?.label],
          ],
        },
        {
          heading: "Employment",
          fields: [
            ["Teacher Type", teacherTypeByKey(t.type).label],
            [t.type === "VISITING" ? "Rate" : "Salary", payRateText(t) ?? "Not set"],
          ],
        },
        {
          heading: "Contact",
          fields: [
            ["Email", t.email],
            ["Phone", t.phone],
            ["Address", t.address],
          ],
        },
        {
          heading: "Guardian",
          fields: [
            ["Guardian Name", t.guardianName],
            ["Guardian Contact", t.guardianContact],
            ["Guardian CNIC", t.guardianCnic],
          ],
        },
        {
          heading: `Teaching Assignments (${assignments.length})`,
          fields: [
            [
              "Courses & Sections",
              assignments.length === 0 ? (
                "No course assigned"
              ) : (
                <ul className="m-0 grid list-disc gap-[0.3rem] pl-[1.1rem]">
                  {assignments.map((sc) => (
                    <li key={sc.id}>
                      <strong>{sc.course.code}</strong> — {sc.course.name}
                      <span className={muted}>
                        {" "}
                        · Section {sc.section.label}, Batch {sc.section.batch}
                      </span>
                    </li>
                  ))}
                </ul>
              ),
            ],
          ],
        },
      ]}
      onEdit={onEdit}
      onClose={onClose}
    />
  );
}

export default function TeachersPage() {
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = useUniversityQuery<{ teachers: TeacherRecord[] }>(`/teachers${queryString({ search: debounced })}`, {
    keepPrevious: true,
  });
  const categories = useProgrammeCategories().data?.categories ?? [];
  const categoryOf = (key: string) => categories.find((c) => c.key === key);
  const teachers = useMemo(() => query.data?.teachers ?? [], [query.data]);
  const filtered = programme ? teachers.filter((t) => t.programme === programme) : teachers;

  const [modal, setModal] = useState<TeacherRecord | "new" | null>(null);
  const [viewing, setViewing] = useState<TeacherRecord | null>(null);
  const [deleting, setDeleting] = useState<TeacherRecord | null>(null);
  const [login, setLogin] = useState<CreatedLogin | null>(null);

  const programmeOptions: FilterOption[] = [
    { value: "", label: "All", count: teachers.length },
    ...categories.map((c) => ({
      value: c.key,
      label: shortProgrammeLabel(c.label),
      count: teachers.filter((t) => t.programme === c.key).length,
    })),
  ];

  async function confirmDelete() {
    if (!deleting) return;
    const teacher = deleting;
    setDeleting(null);
    await runAction(universityAction("delete", `/teachers/${teacher.id}`), `Teacher ${teacher.name} deleted.`);
  }

  return (
    <PageContainer className="gap-0">
      <ClassicPageHeader
        title="Teachers"
        subtitle={`${filtered.length} teacher${filtered.length === 1 ? "" : "s"}`}
        action={
          <ClassicButton onClick={() => setModal("new")}>
            <Plus className="size-4" /> Add Teacher
          </ClassicButton>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Search by name or email…" />
      </div>
      <div className="mb-4">
        <FilterPills label="Programme" options={programmeOptions} value={programme} onChange={setProgramme} />
      </div>

      <QueryView query={query} loading={<ListSkeleton rows={7} />}>
        {() => (
          <TableCard className={cn(query.isPlaceholderData && "opacity-60 transition-opacity")}>
            {filtered.length === 0 ? (
              <TableEmpty icon={GraduationCap}>
                {teachers.length === 0 && !search ? "No teachers added yet." : "No teachers match your filters."}
              </TableEmpty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Programme / Type</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>CNIC</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t, i) => {
                    const courses = [...new Map(t.sectionCourses.map((sc) => [sc.course.id, sc.course])).values()];
                    return (
                      <TableRow
                        key={t.id}
                        title="View details"
                        className="cursor-pointer [&>td]:whitespace-normal"
                        onClick={() => setViewing(t)}
                      >
                        <TableCell className={cn(muted, "w-10")}>{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">{t.name}</div>
                          <div className={muted}>{t.qualification}</div>
                          <LoginFlag teacher={t} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-[0.3rem]">
                            <ProgrammeBadge category={categoryOf(t.programme)} short />
                            <TypeBadge type={t.type} />
                          </div>
                        </TableCell>
                        <TableCell>
                          {courses.length === 0 ? (
                            <span className={muted}>No course assigned</span>
                          ) : (
                            courses.map((c) => (
                              <div key={c.id} className="whitespace-nowrap" title={c.name}>
                                <strong>{c.code}</strong>
                                <span className={muted}> · {c.name}</span>
                              </div>
                            ))
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[220px] truncate text-mid-foreground">{t.email}</div>
                          <div className={muted}>{t.phone}</div>
                        </TableCell>
                        <TableCell className={cn(muted, "!whitespace-nowrap")}>{t.cnic}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap justify-end gap-[0.4rem]">
                            <RowButton kind="edit" icon={Pencil} label="Edit" title="Edit teacher" onClick={() => setModal(t)} />
                            <RowButton kind="delete" icon={Trash2} label="Delete" title="Delete teacher" onClick={() => setDeleting(t)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableCard>
        )}
      </QueryView>

      {viewing ? (
        <TeacherDetails
          teacher={viewing}
          category={categoryOf(viewing.programme)}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setModal(viewing);
            setViewing(null);
          }}
        />
      ) : null}
      {modal ? (
        <ClassicTeacherModal teacher={modal === "new" ? undefined : modal} onClose={() => setModal(null)} onLoginCreated={setLogin} />
      ) : null}
      <LoginCreatedDialog login={login} onClose={() => setLogin(null)} />
      <ClassicConfirm
        open={deleting !== null}
        title="Delete Teacher"
        message={`Are you sure you want to delete "${deleting?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
