import { useState } from "react";
import { CalendarClock, CalendarCheck, Plus, Square, Trash2, X } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { universityAction, useBatches, useUniversityQuery } from "@/features/academics/api";
import { FormDialog } from "@/features/academics/components/form-dialog";
import { Fact, runAction } from "@/features/academics/components/ui";

interface Registration {
  id: number;
  semester: string;
  year: number;
  startDate: Date;
  endDate: Date;
  closedAt: Date | null;
  semesterStart: Date | null;
  semesterEnd: Date | null;
  semesterEndedAt: Date | null;
  status: "UPCOMING" | "ACTIVE" | "CLOSED";
  limits: { id: number; batch: string; creditLimit: number }[];
  _count: { enrollments: number; challans: number };
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const day = (value: Date | null) => (value ? value.toLocaleDateString(undefined, { dateStyle: "medium" }) : "-");
const iso = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
const STATUS_VARIANT = { ACTIVE: "success", UPCOMING: "info", CLOSED: "secondary" } as const;

type Confirm = { title: string; description: string; url: string; method: "post" | "delete"; label: string };

/**
 * Registration periods: an admin opens registration for a semester, students
 * register in that window, and ending the semester lets the next one open.
 */
export default function RegistrationsPage() {
  const query = useUniversityQuery<{ registrations: Registration[] }>("/registrations");
  const batches = useBatches().data?.batches ?? [];
  const [starting, setStarting] = useState(false);
  const [period, setPeriod] = useState<Registration | null>(null);
  const [limitFor, setLimitFor] = useState<Registration | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ registrations }) => (
        <PageContainer>
          <SectionHeader
            title="Registration"
            description="Open registration for a semester; students register for their diploma's courses and join its classrooms."
            breadcrumbs={[{ label: "Registration" }]}
            actions={
              <Button onClick={() => setStarting(true)}>
                <Plus /> Start registration
              </Button>
            }
          />
          {registrations.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No registrations yet" />
          ) : (
            <div className="flex flex-col gap-4">
              {registrations.map((r) => {
                const name = `${titleCase(r.semester)} ${r.year}`;
                return (
                  <Card key={r.id} className="flex flex-col gap-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-heading text-lg font-bold">{name}</h2>
                        <Badge variant={STATUS_VARIANT[r.status]}>{titleCase(r.status)}</Badge>
                        {r.semesterEndedAt ? <Badge variant="outline">Semester ended</Badge> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirm({
                                title: `End registration for ${name}?`,
                                description: "Students can no longer register for this semester.",
                                url: `/registrations/${r.id}/end`,
                                method: "post",
                                label: "End registration",
                              })
                            }
                          >
                            <Square /> End registration
                          </Button>
                        ) : null}
                        {!r.semesterEndedAt ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirm({
                                title: `End the ${name} semester?`,
                                description: "Its registration closes too, and registration for the next semester can be opened.",
                                url: `/registrations/${r.id}/end-semester`,
                                method: "post",
                                label: "End semester",
                              })
                            }
                          >
                            <CalendarCheck /> End semester
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => setPeriod(r)}>
                          <CalendarClock /> Semester dates
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Delete ${name}`}
                          onClick={() =>
                            setConfirm({
                              title: `Delete ${name}?`,
                              description: `This deletes ${r._count.enrollments} course registrations (with their attendance and marks) and ${r._count.challans} challans. Not allowed once a challan is paid.`,
                              url: `/registrations/${r.id}`,
                              method: "delete",
                              label: "Delete",
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Fact label="Registration window">
                        {day(r.startDate)} - {day(r.endDate)}
                      </Fact>
                      <Fact label="Semester">
                        {day(r.semesterStart)} - {day(r.semesterEnd)}
                      </Fact>
                      <Fact label="Course registrations">{r._count.enrollments}</Fact>
                      <Fact label="Challans">{r._count.challans}</Fact>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Credit limits (default 40)
                      </span>
                      {r.limits.map((limit) => (
                        <Badge key={limit.id} variant="outline" className="gap-1">
                          Batch {limit.batch}: {limit.creditLimit} CR
                          <button
                            aria-label={`Remove the batch ${limit.batch} limit`}
                            onClick={() =>
                              runAction(universityAction("delete", `/registrations/${r.id}/limits/${encodeURIComponent(limit.batch)}`))
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => setLimitFor(r)}>
                        <Plus /> Set limit
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <FormDialog
            open={starting}
            onOpenChange={setStarting}
            title="Start registration"
            description="The year follows from the semester. The previous semester must have ended."
            fields={[
              {
                name: "semester",
                label: "Semester",
                type: "select",
                required: true,
                options: ["SPRING", "SUMMER", "FALL"].map((s) => ({ value: s, label: titleCase(s) })),
              },
              { name: "startDate", label: "Registration opens", type: "date", required: true },
              { name: "endDate", label: "Registration closes", type: "date", required: true },
              { name: "semesterStart", label: "Semester starts", type: "date", required: true },
              { name: "semesterEnd", label: "Semester ends", type: "date", required: true },
            ]}
            submitLabel="Start registration"
            onSubmit={(values) => universityAction("post", "/registrations", values)}
          />
          <FormDialog
            open={period !== null}
            onOpenChange={(open) => !open && setPeriod(null)}
            title="Semester dates"
            description="While today falls inside them, this is the current term."
            fields={[
              { name: "semesterStart", label: "Semester starts", type: "date", required: true },
              { name: "semesterEnd", label: "Semester ends", type: "date", required: true },
            ]}
            initialValues={period ? { semesterStart: iso(period.semesterStart), semesterEnd: iso(period.semesterEnd) } : undefined}
            onSubmit={(values) => universityAction("put", `/registrations/${period!.id}/period`, values)}
          />
          <FormDialog
            open={limitFor !== null}
            onOpenChange={(open) => !open && setLimitFor(null)}
            title="Batch credit limit"
            description="Overrides the default 40 credit hours for one batch in this registration."
            fields={[
              {
                name: "batch",
                label: "Batch",
                type: "select",
                required: true,
                options: batches.map((b) => ({ value: b, label: b })),
              },
              { name: "creditLimit", label: "Credit limit", type: "number", required: true, min: 1, max: 100 },
            ]}
            onSubmit={(values) => universityAction("put", `/registrations/${limitFor!.id}/limits`, values)}
          />
          <ConfirmDialog
            open={confirm !== null}
            onOpenChange={(open) => !open && setConfirm(null)}
            title={confirm?.title ?? ""}
            description={confirm?.description ?? ""}
            confirmLabel={confirm?.label ?? "Confirm"}
            destructive={confirm?.method === "delete"}
            pending={pending}
            onConfirm={async () => {
              if (!confirm) return;
              setPending(true);
              await runAction(universityAction(confirm.method, confirm.url));
              setPending(false);
              setConfirm(null);
            }}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
