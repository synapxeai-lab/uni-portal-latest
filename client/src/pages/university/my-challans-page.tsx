import { useState } from "react";
import { Printer, Receipt } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { AppLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { universityAction, useUniversityQuery } from "@/features/academics/api";
import { Fact, formatRs, ordinal, runAction } from "@/features/academics/components/ui";
import { CHALLAN_STATUS } from "@/pages/university/fees-page";

interface MyChallans {
  student: { name: string; rollNo: string };
  challans: {
    id: number;
    amount: number;
    accountNumber: string;
    status: string;
    createdAt: Date;
    semester: number | null;
    registration: { semester: string; year: number; endDate: Date };
  }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** A student's fee challans: pay into the institute's account, then report it for approval. */
export default function MyChallansPage() {
  const query = useUniversityQuery<MyChallans>("/my/challans");
  const [paying, setPaying] = useState<number | null>(null);
  return (
    <QueryView query={query} loading={<AppLoading />}>
      {({ student, challans }) => (
        <PageContainer>
          <SectionHeader
            title="Fee challan"
            description="Pay the amount into the account below, then mark it paid. It's settled once an administrator approves it."
            breadcrumbs={[{ label: "Fee challan" }]}
            actions={
              challans.length > 0 ? (
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer /> Print
                </Button>
              ) : undefined
            }
          />
          {challans.length === 0 ? (
            <EmptyState icon={Receipt} title="No challans yet" description="A challan is created when you register for courses." />
          ) : (
            challans.map((c) => (
              <Card key={c.id} className="flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-heading text-lg font-bold">
                    {titleCase(c.registration.semester)} {c.registration.year}
                    {c.semester ? ` · ${ordinal(c.semester)} semester` : ""}
                  </h2>
                  <Badge variant={CHALLAN_STATUS[c.status]?.variant ?? "secondary"}>{CHALLAN_STATUS[c.status]?.label ?? c.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Fact label="Student">
                    {student.name} ({student.rollNo})
                  </Fact>
                  <Fact label="Amount">
                    <span className="text-lg font-bold">{formatRs(c.amount)}</span>
                  </Fact>
                  <Fact label="Pay into account">
                    <span className="font-mono">{c.accountNumber}</span>
                  </Fact>
                  <Fact label="Issued">{c.createdAt.toLocaleDateString(undefined, { dateStyle: "medium" })}</Fact>
                </div>
                {c.status === "UNPAID" ? (
                  <Button className="self-start" onClick={() => setPaying(c.id)}>
                    I've paid this challan
                  </Button>
                ) : null}
              </Card>
            ))
          )}
          <ConfirmDialog
            open={paying !== null}
            onOpenChange={(open) => !open && setPaying(null)}
            title="Report this payment?"
            description="Only confirm once you've paid the full amount into the account. An administrator checks it before it's marked paid."
            confirmLabel="I've paid"
            onConfirm={async () => {
              if (paying === null) return;
              await runAction(universityAction("post", `/my/challans/${paying}/pay`));
              setPaying(null);
            }}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
