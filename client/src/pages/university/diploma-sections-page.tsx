import { useState } from "react";
import { useParams } from "react-router";
import { Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { ListSkeleton } from "@/components/states/skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BackLink,
  CardGrid,
  ClassicConfirm,
  ClassicPageHeader,
  FilterPills,
  RowButton,
  TableEmpty,
  useViewMode,
  ViewToggle,
} from "@/components/classic/classic";
import { QueryView } from "@/app/route-states";
import { useRouter } from "@/lib/navigation";
import { universityAction, useBatches, useDepartment } from "@/features/academics/api";
import { runAction, TableCard } from "@/features/academics/components/ui";
import type { SectionSummary } from "@/features/academics/types";

/**
 * A diploma's sections (admin): an exact replica of the old University
 * Portal's page - batch pills, Cards/List toggle, and Delete per section.
 */
export default function DiplomaSectionsPage() {
  const id = Number(useParams().id);
  const router = useRouter();
  const query = useDepartment(id);
  const allBatches = useBatches().data?.batches ?? [];
  const [batchFilter, setBatchFilter] = useState("");
  const [view, setView] = useViewMode();
  const [deleting, setDeleting] = useState<SectionSummary | null>(null);
  const department = query.data?.department;

  async function confirmDelete() {
    if (!deleting) return;
    const section = deleting;
    setDeleting(null);
    await runAction(universityAction("delete", `/sections/${section.id}`), `Section ${section.label} deleted.`);
  }

  return (
    <PageContainer className="gap-0">
      <BackLink fallback={`/admin/diplomas/${id}`}>Back to {department?.name ?? "diploma"}</BackLink>
      <div className="mt-4">
        <QueryView query={query} loading={<ListSkeleton rows={6} />}>
          {({ department: d }) => {
            // Newest batch first, then Section A, B, C… within a batch.
            const sections = [...d.sections].sort(
              (a, b) => b.batch.localeCompare(a.batch, undefined, { numeric: true }) || a.label.localeCompare(b.label),
            );
            const withSections = [...new Set(sections.map((s) => s.batch))];
            const batches = [...new Set([...withSections, ...allBatches])];
            const visible = batchFilter ? sections.filter((s) => s.batch === batchFilter) : sections;
            const open = (section: SectionSummary) => router.push(`/admin/sections/${section.id}`);
            const assigned = (section: SectionSummary) => section.courseLinks.filter((l) => l.teacher).length;
            return (
              <>
                <ClassicPageHeader
                  title="Sections"
                  subtitle={`${d.name} · ${sections.length} sections across ${withSections.length} batches`}
                />
                <div className="mb-4">
                  <FilterPills
                    label="Batch"
                    value={batchFilter}
                    onChange={setBatchFilter}
                    options={[
                      { value: "", label: "All", count: sections.length },
                      ...batches.map((b) => ({ value: b, label: b, count: sections.filter((s) => s.batch === b).length })),
                    ]}
                  />
                </div>
                <div className="mb-5">
                  <ViewToggle view={view} onChange={setView} />
                </div>

                {visible.length === 0 ? (
                  <TableEmpty>
                    {batchFilter ? `No sections in Batch ${batchFilter} yet.` : "No sections yet."} Add sections from the Batches page.
                  </TableEmpty>
                ) : view === "list" ? (
                  <TableCard>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Section</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Students</TableHead>
                          <TableHead>Teachers Assigned</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visible.map((section) => (
                          <TableRow key={section.id} className="cursor-pointer" onClick={() => open(section)}>
                            <TableCell className="font-semibold">Section {section.label}</TableCell>
                            <TableCell>Batch {section.batch}</TableCell>
                            <TableCell>{section._count.students}</TableCell>
                            <TableCell>
                              {assigned(section)} of {section.courseLinks.length} courses
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end">
                                <RowButton
                                  kind="delete"
                                  icon={Trash2}
                                  label="Delete"
                                  title={`Delete Section ${section.label}`}
                                  onClick={() => setDeleting(section)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableCard>
                ) : (
                  <CardGrid>
                    {visible.map((section) => (
                      <div
                        key={section.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => open(section)}
                        onKeyDown={(e) => e.key === "Enter" && open(section)}
                        className="cursor-pointer rounded-[10px] border border-border bg-card p-[1.1rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-[0_2px_8px_rgba(23,31,50,.07)]"
                      >
                        <div className="mb-3 flex items-center justify-between gap-[0.6rem]">
                          <span className="text-[0.8rem] font-bold text-foreground">
                            Section {section.label} · Batch {section.batch}
                          </span>
                          <button
                            type="button"
                            title={`Delete Section ${section.label}`}
                            aria-label={`Delete Section ${section.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleting(section);
                            }}
                            className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-card text-destructive transition-colors hover:border-destructive-border hover:bg-destructive-soft"
                          >
                            <Trash2 className="size-[13px]" />
                          </button>
                        </div>
                        <p className="text-[0.82rem] text-muted-foreground">{section._count.students} students enrolled</p>
                        <p className="mt-[0.2rem] text-[0.82rem] text-muted-foreground">
                          {assigned(section)} of {section.courseLinks.length} courses have a teacher assigned
                        </p>
                      </div>
                    ))}
                  </CardGrid>
                )}
              </>
            );
          }}
        </QueryView>
      </div>
      <ClassicConfirm
        open={deleting !== null}
        title="Delete Section"
        message={`Are you sure you want to delete Section ${deleting?.label} (Batch ${deleting?.batch})? Any enrolled students will be unenrolled and all per-course teacher assignments for this section will be removed. This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
