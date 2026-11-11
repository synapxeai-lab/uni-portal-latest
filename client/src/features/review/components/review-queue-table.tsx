import Link from "@/components/ui/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateTimeText } from "@/components/ui/date-time-text";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { formatGrade } from "@/features/submissions/lib/format-grade";
import { SubmissionStatusBadge } from "@/features/submissions/components/submission-status-badge";
import { getInitials } from "@/lib/utils";

import type { RawSearchParams } from "../lib/review-params";
import type { ReviewQueueRow, ReviewSortKey } from "../types";
import { ReviewRowActions } from "./review-row-actions";

const SORT_COLUMNS: { key: ReviewSortKey; label: string }[] = [
  { key: "studentName", label: "Student" },
  { key: "assignmentName", label: "Assignment" },
  { key: "dueDate", label: "Due date" },
];

function buildSortHref(searchParams: RawSearchParams, sort: ReviewSortKey): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && key !== "sort" && key !== "page") {
      params.set(key, value);
    }
  }
  params.set("sort", sort);
  return `/review?${params.toString()}`;
}

interface ReviewQueueTableProps {
  rows: ReviewQueueRow[];
  currentSort: ReviewSortKey;
  searchParams: RawSearchParams;
}

export function ReviewQueueTable({ rows, currentSort, searchParams }: ReviewQueueTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing to review"
        description="Submissions that need grading, are late, or were recently returned will show up here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORT_COLUMNS.map((column) => (
            <TableHead key={column.key}>
              <Link
                href={buildSortHref(searchParams, column.key)}
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                {column.label}
                {currentSort === column.key ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                )}
              </Link>
            </TableHead>
          ))}
          <TableHead>Classroom</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>
            <Link
              href={buildSortHref(searchParams, "newest")}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              Submitted
              {currentSort === "newest" || currentSort === "oldest" ? (
                currentSort === "newest" ? (
                  <ArrowDown className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )
              ) : (
                <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
              )}
            </Link>
          </TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.submissionId}>
            <TableCell>
              <span className="flex items-center gap-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                  {row.studentImage ? (
                    <AvatarImage src={row.studentImage} alt={row.studentName} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {getInitials(row.studentName)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{row.studentName}</span>
              </span>
            </TableCell>
            <TableCell>
              <Link
                href={`/classes/${row.classroomId}/classwork/${row.assignmentId}`}
                className="link-pill -mx-3 -my-1.5 text-foreground"
              >
                {row.assignmentTitle}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.dueDate ? <DateTimeText value={row.dueDate} /> : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">{row.classroomTitle}</TableCell>
            <TableCell>
              <SubmissionStatusBadge status={row.displayStatus} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatGrade(row.grade, row.maxPoints)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.submittedAt ? <DateTimeText value={row.submittedAt} /> : "—"}
            </TableCell>
            <TableCell className="text-right">
              <ReviewRowActions row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
