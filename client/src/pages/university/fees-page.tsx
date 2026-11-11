import { useState } from "react";
import { BadgeCheck, RefreshCw, Receipt } from "lucide-react";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/layouts";
import { QueryView } from "@/app/route-states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { queryString, universityAction, useProgrammeCategories, useUniversityQuery } from "@/features/academics/api";
import { Fact, formatRs, ordinal, runAction, TableCard } from "@/features/academics/components/ui";
import { cn } from "@/lib/utils";

export const CHALLAN_STATUS: Record<string, { label: string; variant: "warning" | "info" | "success" }> = {
  UNPAID: { label: "Unpaid", variant: "warning" },
  PENDING_APPROVAL: { label: "Awaiting approval", variant: "info" },
  PAID: { label: "Paid", variant: "success" },
};

interface ChallanList {
  totals: Record<string, number>;
  challans: {
    id: number;
    amount: number;
    status: string;
    updatedAt: Date;
    semester: number | null;
    registration: { semester: string; year: number };
    student: { id: number; name: string; rollNo: string; batch: string; section: string };
    diploma: { code: string } | null;
  }[];
}

interface TeacherPay {
  teachers: {
    id: number;
    name: string;
    email: string;
    type: string;
    salary: number | null;
    ratePerCreditHour: number | null;
    creditHours: number;
    pay: number;
    courses: { id: number; course: { code: string }; section: { label: string; batch: string } }[];
  }[];
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

function Challans() {
  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [programme, setProgramme] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const categories = useProgrammeCategories().data?.categories ?? [];
  const query = useUniversityQuery<ChallanList>(`/challans${queryString({ status, programme, search: debounced })}`, {
    keepPrevious: true,
  });
  const [busy, setBusy] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(CHALLAN_STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={programme} onChange={(e) => setProgramme(e.target.value)} aria-label="Programme">
          <option value="">All programmes</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <Input placeholder="Search name or roll no." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
      </div>
      <QueryView query={query} loading={<AdminLoading />}>
        {({ totals, challans }) => (
          <>
            <Card className="grid grid-cols-3 gap-4 p-5">
              <Fact label="Unpaid">{formatRs(totals.UNPAID)}</Fact>
              <Fact label="Awaiting approval">{formatRs(totals.PENDING_APPROVAL)}</Fact>
              <Fact label="Paid">{formatRs(totals.PAID)}</Fact>
            </Card>
            {challans.length === 0 ? (
              <EmptyState icon={Receipt} title="No challans match" />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-0" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {challans.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`/admin/students/${c.student.id}`} className="flex flex-col">
                            <span className="font-semibold hover:underline">{c.student.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {c.student.rollNo} · {c.student.batch}-{c.student.section}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {titleCase(c.registration.semester)} {c.registration.year}
                          <span className="block text-xs text-muted-foreground">
                            {c.diploma?.code ?? ""}
                            {c.semester ? ` · ${ordinal(c.semester)} semester` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatRs(c.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={CHALLAN_STATUS[c.status]?.variant ?? "secondary"}>{CHALLAN_STATUS[c.status]?.label ?? c.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {c.status === "PENDING_APPROVAL" ? (
                            <Button
                              size="sm"
                              disabled={busy === c.id}
                              onClick={async () => {
                                setBusy(c.id);
                                await runAction(universityAction("put", `/challans/${c.id}/approve`));
                                setBusy(null);
                              }}
                            >
                              <BadgeCheck /> Approve
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
          </>
        )}
      </QueryView>
    </div>
  );
}

function TeachersPay() {
  const query = useUniversityQuery<TeacherPay>("/teachers-pay");
  return (
    <QueryView query={query} loading={<AdminLoading />}>
      {({ teachers }) => (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Teaching</TableHead>
                <TableHead className="text-right">Credit hours</TableHead>
                <TableHead className="text-right">Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.email}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.type === "VISITING" ? `Visiting · ${formatRs(t.ratePerCreditHour)}/credit hr` : "Permanent"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.courses.length === 0 ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : (
                        t.courses.map((c) => (
                          <Badge key={c.id} variant="outline">
                            {c.course.code} {c.section.batch}-{c.section.label}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.creditHours}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatRs(t.pay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </QueryView>
  );
}

/** Fees: students' challans (approve reported payments) and teachers' pay. */
export default function FeesPage() {
  const [tab, setTab] = useState<"challans" | "pay">("challans");
  const [recalculating, setRecalculating] = useState(false);
  return (
    <PageContainer>
      <SectionHeader
        title="Fees"
        description="Challans follow each student's registered courses and update when fees change."
        breadcrumbs={[{ label: "Fees" }]}
        actions={
          <Button
            variant="outline"
            disabled={recalculating}
            onClick={async () => {
              setRecalculating(true);
              await runAction(universityAction("post", "/challans/recalculate"));
              setRecalculating(false);
            }}
          >
            <RefreshCw /> Recalculate all
          </Button>
        }
      />
      <div className="flex gap-1 border-b border-border" role="tablist">
        {(
          [
            ["challans", "Fee challans"],
            ["pay", "Teachers' pay"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-semibold",
              tab === key ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "challans" ? <Challans /> : <TeachersPay />}
    </PageContainer>
  );
}
