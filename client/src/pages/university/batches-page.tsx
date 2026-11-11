import { useState } from "react";
import { CalendarRange, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useBatches, useDepartments } from "@/features/academics/api";
import { BatchDialog } from "@/features/academics/components/structure-dialogs";
import { runAction } from "@/features/academics/components/ui";
import type { BatchDetail } from "@/features/academics/types";

/** Intake batches: the fixed yearly ones plus any added by an admin. */
export default function BatchesPage() {
  const query = useBatches();
  const departments = useDepartments().data?.departments ?? [];
  const [editing, setEditing] = useState<BatchDetail | "new" | null>(null);
  const [deleting, setDeleting] = useState<BatchDetail | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ details }) => (
        <PageContainer>
          <SectionHeader
            title="Batches"
            description="A new batch starts every Fall. Each batch has its own sections in every diploma."
            breadcrumbs={[{ label: "Batches" }]}
            actions={
              <Button onClick={() => setEditing("new")}>
                <Plus /> Add batch
              </Button>
            }
          />
          {details.length === 0 ? (
            <EmptyState icon={CalendarRange} title="No batches yet" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {details.map((batch) => {
                const sections = departments.flatMap((d) => d.sections.filter((s) => s.batch === batch.name));
                const students = sections.reduce((n, s) => n + s._count.students, 0);
                return (
                  <Card key={batch.name} className="flex flex-col gap-3 p-4">
                    <Link href={`/admin/batches/${encodeURIComponent(batch.name)}`} className="flex items-center justify-between">
                      <span className="flex flex-col">
                        <span className="font-heading text-lg font-bold">Batch {batch.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {batch.year ? `Fall ${batch.year} intake` : "No intake year"} · {sections.length} sections ·{" "}
                          {students} students
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(batch)}>
                        <Pencil /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleting(batch)}>
                        <Trash2 /> Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <BatchDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            batch={editing === "new" || editing === null ? undefined : editing}
          />
          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(open) => !open && setDeleting(null)}
            title={`Delete batch ${deleting?.name}?`}
            description="Its sections and their course offerings are deleted. A batch that still has students can't be deleted."
            confirmLabel="Delete"
            destructive
            pending={pending}
            onConfirm={async () => {
              if (!deleting) return;
              setPending(true);
              await runAction(universityAction("delete", `/batches/${encodeURIComponent(deleting.name)}`));
              setPending(false);
              setDeleting(null);
            }}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
