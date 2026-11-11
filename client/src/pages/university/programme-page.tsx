import { useState } from "react";
import { useParams } from "react-router";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { NotFoundPage } from "@/app/not-found-page";
import { universityAction, useDepartments, useProgrammeCategories } from "@/features/academics/api";
import { DiplomaDialog } from "@/features/academics/components/structure-dialogs";
import { ColourTile, formatRs, ordinal, runAction, TableCard } from "@/features/academics/components/ui";
import type { Department } from "@/features/academics/types";

/** One main programme's diplomas, in semester order. */
export default function ProgrammePage() {
  const { slug = "" } = useParams();
  const categoriesQuery = useProgrammeCategories();
  const category = categoriesQuery.data?.categories.find((c) => c.slug === slug);
  const departmentsQuery = useDepartments(category ? { category: category.key } : {});
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [pending, setPending] = useState(false);

  if (categoriesQuery.data && !category) {
    return <NotFoundPage />;
  }

  return (
    <QueryView query={departmentsQuery} loading={<AdminLoading />}>
      {({ departments }) => {
        const diplomas = departments.filter((d) => d.category === category?.key);
        return (
          <PageContainer>
            <SectionHeader
              title={category?.label ?? "Programme"}
              description={category?.description}
              breadcrumbs={[{ label: "Programmes", href: "/admin/programmes" }, { label: category?.label ?? "" }]}
              actions={
                <Button onClick={() => setEditing("new")}>
                  <Plus /> Add diploma
                </Button>
              }
            />

            {diplomas.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No diplomas yet"
                description="Add the programme's first diploma; it becomes semester 1."
              />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Semester</TableHead>
                      <TableHead>Diploma</TableHead>
                      <TableHead className="text-right">Courses</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="w-0" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diplomas.map((diploma) => (
                      <TableRow key={diploma.id}>
                        <TableCell>
                          <Badge variant="outline">{ordinal(diploma.semester)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/diplomas/${diploma.id}`} className="flex items-center gap-3">
                            <ColourTile color={diploma.color} bg={diploma.bg} className="h-8 w-8 text-xs font-bold">
                              {diploma.code.slice(0, 3)}
                            </ColourTile>
                            <span className="flex flex-col">
                              <span className="font-semibold text-foreground hover:underline">{diploma.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {diploma.code} · Head: {diploma.head}
                              </span>
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{diploma.courses.length}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {diploma.discountRate > 0 ? (
                            <span className="flex flex-col">
                              <span>{formatRs(diploma.netFee)}</span>
                              <span className="text-xs text-muted-foreground line-through">{formatRs(diploma.fee)}</span>
                            </span>
                          ) : (
                            formatRs(diploma.fee)
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{diploma.studentsCount}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" aria-label={`Edit ${diploma.name}`} onClick={() => setEditing(diploma)}>
                              <Pencil />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`Delete ${diploma.name}`} onClick={() => setDeleting(diploma)}>
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}

            <DiplomaDialog
              open={editing !== null}
              onOpenChange={(open) => !open && setEditing(null)}
              department={editing === "new" || editing === null ? undefined : editing}
              categories={categoriesQuery.data?.categories ?? []}
              defaultCategory={category?.key}
            />
            <ConfirmDialog
              open={deleting !== null}
              onOpenChange={(open) => !open && setDeleting(null)}
              title="Delete diploma?"
              description={
                deleting
                  ? `Delete ${deleting.name}? Its courses, sections and their registrations are deleted too.`
                  : ""
              }
              confirmLabel="Delete"
              destructive
              pending={pending}
              onConfirm={async () => {
                if (!deleting) return;
                setPending(true);
                await runAction(universityAction("delete", `/departments/${deleting.id}`));
                setPending(false);
                setDeleting(null);
              }}
            />
          </PageContainer>
        );
      }}
    </QueryView>
  );
}
