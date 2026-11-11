import { useState } from "react";
import { BookOpen, ChevronRight, Layers, Pencil, Plus, Trash2, Users } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useDepartments, useProgrammeCategories } from "@/features/academics/api";
import { ProgrammeDialog } from "@/features/academics/components/structure-dialogs";
import { ColourTile, ProgrammeIcon, runAction } from "@/features/academics/components/ui";
import type { ProgrammeCategory } from "@/features/academics/types";

/** Main programmes (Culinary, CPD...), each opening its diplomas. */
export default function ProgrammesPage() {
  const categoriesQuery = useProgrammeCategories();
  const departments = useDepartments().data?.departments ?? [];
  const [editing, setEditing] = useState<ProgrammeCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<ProgrammeCategory | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <QueryView query={categoriesQuery} loading={<AdminLoading />}>
      {({ categories }) => (
        <PageContainer>
          <SectionHeader
            title="Programmes"
            description={`${departments.length} diplomas across ${categories.length} main programmes`}
            breadcrumbs={[{ label: "Programmes" }]}
            actions={
              <Button onClick={() => setEditing("new")}>
                <Plus /> Add main programme
              </Button>
            }
          />

          {categories.length === 0 ? (
            <EmptyState icon={Layers} title="No main programmes yet" />
          ) : (
            <div className="flex flex-col gap-3">
              {categories.map((category) => {
                const diplomas = departments.filter((d) => d.category === category.key);
                const courses = diplomas.reduce((n, d) => n + d.courses.length, 0);
                const students = diplomas.reduce((n, d) => n + d.studentsCount, 0);
                return (
                  <Card
                    key={category.key}
                    className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-gold"
                  >
                    <ColourTile color={category.color} bg={category.bg}>
                      <ProgrammeIcon name={category.icon} />
                    </ColourTile>
                    <Link
                      href={`/admin/programmes/${category.slug}`}
                      className="flex min-w-0 flex-1 flex-col gap-1"
                    >
                      <span className="font-heading text-base font-bold text-foreground">{category.label}</span>
                      <span className="text-sm text-muted-foreground">{category.description}</span>
                    </Link>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {diplomas.length} diplomas
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" /> {courses} courses
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {students} students
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(category)}>
                        <Pencil /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={diplomas.length > 0}
                        title={diplomas.length > 0 ? "Delete or move its diplomas first" : undefined}
                        onClick={() => setDeleting(category)}
                      >
                        <Trash2 /> Delete
                      </Button>
                      <Button variant="ghost" size="icon" asChild aria-label={`Open ${category.label}`}>
                        <Link href={`/admin/programmes/${category.slug}`}>
                          <ChevronRight />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <ProgrammeDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            category={editing === "new" || editing === null ? undefined : editing}
          />
          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(open) => !open && setDeleting(null)}
            title="Delete main programme?"
            description={deleting ? `Delete ${deleting.label}? This cannot be undone.` : ""}
            confirmLabel="Delete"
            destructive
            pending={pending}
            onConfirm={async () => {
              if (!deleting) return;
              setPending(true);
              await runAction(universityAction("delete", `/programme-categories/${deleting.id}`));
              setPending(false);
              setDeleting(null);
            }}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
