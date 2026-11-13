import { useState } from "react";
import { CalendarRange, ChevronRight, Layers, LayoutList, Pencil, Plus, Trash2, Users } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "@/components/ui/link";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useBatches } from "@/features/academics/api";
import { BatchDialog } from "@/features/academics/components/structure-dialogs";
import { runAction } from "@/features/academics/components/ui";
import type { BatchCounts, BatchDetail } from "@/features/academics/types";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const NO_COUNTS: BatchCounts = { sections: 0, diplomas: 0, students: 0 };

function Stat({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

/** One batch: its intake year, name and counts, opening the batch; Edit and Delete beside it. */
function BatchRow({
  batch,
  counts,
  onEdit,
  onDelete,
}: {
  batch: BatchDetail;
  counts: BatchCounts;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const href = `/admin/batches/${encodeURIComponent(batch.name)}`;
  // "Batch 2026" already says its year; a named batch shows it underneath.
  const showYear = batch.year !== null && batch.name !== String(batch.year);
  return (
    <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-gold md:flex-row md:items-center md:gap-4 md:px-5">
      <Link href={href} className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <span className="flex min-w-0 flex-1 items-center gap-4">
          <span className="shrink-0 rounded-md bg-gold-soft px-3 py-1.5 font-heading text-sm font-extrabold tabular-nums text-foreground">
            {batch.year ?? "—"}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-heading text-base font-bold">Batch {batch.name}</span>
            {showYear ? <span className="text-sm text-muted-foreground">Batch year {batch.year}</span> : null}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <Stat icon={LayoutList} label={plural(counts.sections, "section")} />
          <Stat icon={Layers} label={plural(counts.diplomas, "diploma")} />
          <Stat icon={Users} label={plural(counts.students, "student")} />
          <ChevronRight className="hidden size-4 md:block" aria-hidden />
        </span>
      </Link>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-gold/40 bg-gold-soft text-foreground hover:bg-gold-soft hover:brightness-95"
          onClick={onEdit}
        >
          <Pencil /> Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive-border bg-destructive-soft text-destructive hover:border-destructive hover:bg-destructive-soft hover:text-destructive"
          disabled={counts.students > 0}
          title={counts.students > 0 ? `Move or remove its ${plural(counts.students, "student")} first` : undefined}
          onClick={onDelete}
        >
          <Trash2 /> Delete
        </Button>
      </div>
    </Card>
  );
}

/** Intake batches: the fixed yearly ones plus any added by an admin. */
export default function BatchesPage() {
  const query = useBatches();
  const [editing, setEditing] = useState<BatchDetail | "new" | null>(null);
  const [deleting, setDeleting] = useState<BatchDetail | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ details, counts }) => (
        <PageContainer>
          <SectionHeader
            title="Batches"
            description={`${details.length} ${details.length === 1 ? "batch" : "batches"} · a new batch opens every September`}
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
            <div className="flex flex-col gap-3">
              {details.map((batch) => (
                <BatchRow
                  key={batch.name}
                  batch={batch}
                  counts={counts[batch.name] ?? NO_COUNTS}
                  onEdit={() => setEditing(batch)}
                  onDelete={() => setDeleting(batch)}
                />
              ))}
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
