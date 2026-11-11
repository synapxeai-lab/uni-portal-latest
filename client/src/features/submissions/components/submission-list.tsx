import { useMemo, useState } from "react";
import Link from "@/components/ui/link";
import { ArrowDownAZ, ArrowUpAZ, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { EmptyState } from "@/components/states/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getInitials } from "@/lib/utils";

import {
  SUBMISSION_DISPLAY_STATUS_LABEL,
  type SubmissionDisplayStatus,
} from "../lib/display-status";
import { formatGrade } from "../lib/format-grade";
import type { StudentSubmissionRow, SubmissionOverview } from "../types";
import { SubmissionStatsRow } from "./submission-stats-row";
import { SubmissionStatusBadge } from "./submission-status-badge";

type SortKey = "name" | "status" | "submittedAt" | "updatedAt";

// A student's draft is never visible to a teacher, so "Draft" is never a
// value StudentSubmissionRow.displayStatus can take here - don't offer it as
// a filter option (it would always return zero results).
const TEACHER_VISIBLE_STATUSES = (
  Object.keys(SUBMISSION_DISPLAY_STATUS_LABEL) as SubmissionDisplayStatus[]
).filter((status) => status !== "DRAFT");

function compareRows(a: StudentSubmissionRow, b: StudentSubmissionRow, sortKey: SortKey): number {
  switch (sortKey) {
    case "status":
      return a.displayStatus.localeCompare(b.displayStatus);
    case "submittedAt":
      return (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0);
    case "updatedAt":
      return (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0);
    case "name":
    default:
      return a.studentName.localeCompare(b.studentName);
  }
}

interface SubmissionListProps {
  classroomId: string;
  assignmentId: string;
  maxPoints: number | null;
  overview: SubmissionOverview;
}

export function SubmissionList({
  classroomId,
  assignmentId,
  maxPoints,
  overview,
}: SubmissionListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubmissionDisplayStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = overview.rows.filter((row) => {
      const matchesSearch = term === "" || row.studentName.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "ALL" || row.displayStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => compareRows(a, b, sortKey));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [overview.rows, search, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <SubmissionStatsRow overview={overview} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by student name…"
            className="pl-9"
            aria-label="Search by student name"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as SubmissionDisplayStatus | "ALL")
          }
          aria-label="Filter by status"
          className="sm:w-48"
        >
          <option value="ALL">All statuses</option>
          {TEACHER_VISIBLE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SUBMISSION_DISPLAY_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      </div>

      {overview.rows.length === 0 ? (
        <EmptyState
          title="No students enrolled"
          description="Add students to this class to see their submissions here."
        />
      ) : visibleRows.length === 0 ? (
        <EmptyState
          title="No matching students"
          description="Try a different search term or status filter."
        />
      ) : (
        <Card>
          <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <button
              type="button"
              className="flex items-center gap-1 text-left"
              onClick={() => toggleSort("name")}
            >
              Student
              {sortKey === "name" ? (
                sortDir === "asc" ? (
                  <ArrowDownAZ className="h-3 w-3" aria-hidden />
                ) : (
                  <ArrowUpAZ className="h-3 w-3" aria-hidden />
                )
              ) : null}
            </button>
            <button type="button" onClick={() => toggleSort("status")}>
              Status
            </button>
            <span>Grade</span>
            <button type="button" onClick={() => toggleSort("submittedAt")}>
              Submitted
            </button>
            <button type="button" onClick={() => toggleSort("updatedAt")}>
              Last updated
            </button>
          </div>

          <ul className="flex flex-col divide-y divide-border">
            {visibleRows.map((row) => (
              <li key={row.studentId}>
                <Link
                  href={`/classes/${classroomId}/classwork/${assignmentId}/submissions/${row.studentId}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm hover:bg-accent sm:grid-cols-[1fr_auto_auto_auto_auto]"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Avatar className="h-7 w-7 shrink-0">
                      {row.studentImage ? (
                        <AvatarImage src={row.studentImage} alt={row.studentName} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {getInitials(row.studentName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium text-foreground">{row.studentName}</span>
                  </span>
                  <span className="justify-self-start sm:justify-self-auto">
                    <SubmissionStatusBadge status={row.displayStatus} />
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {formatGrade(row.grade, maxPoints)}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {row.submittedAt ? <DateTimeText value={row.submittedAt} /> : "—"}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {row.updatedAt ? <DateTimeText value={row.updatedAt} /> : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
