import Link from "@/components/ui/link";
import { useRouter } from "@/lib/navigation";
import { usePathname, useSearchParams } from "@/lib/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { statusBadgeVariant, statusLabels } from "../lib/classroom-display";
import type { AdminClassroomSummary, ClassroomSortField, SortDirection } from "../types";
import { ClassroomRowActions } from "./classroom-row-actions";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const columns: { field: ClassroomSortField; label: string }[] = [
  { field: "title", label: "Title" },
  { field: "status", label: "Status" },
  { field: "memberCount", label: "Members" },
  { field: "createdAt", label: "Created" },
];

interface ClassroomsTableProps {
  classrooms: AdminClassroomSummary[];
  sortField?: ClassroomSortField;
  sortDir: SortDirection;
}

export function ClassroomsTable({ classrooms, sortField, sortDir }: ClassroomsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function sortHref(field: ClassroomSortField): string {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir: SortDirection = sortField === field && sortDir === "asc" ? "desc" : "asc";
    params.set("sort", `${field}:${nextDir}`);
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.field}>
              <Link
                href={sortHref(column.field)}
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                {column.label}
                {sortField === column.field ? (
                  sortDir === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )
                ) : (
                  <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                )}
              </Link>
            </TableHead>
          ))}
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {classrooms.map((classroom) => (
          <TableRow key={classroom.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{classroom.title}</span>
                <span className="text-xs text-muted-foreground">{classroom.code}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant[classroom.status]}>
                {statusLabels[classroom.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{classroom.memberCount}</TableCell>
            <TableCell className="text-muted-foreground">
              {dateFormatter.format(classroom.createdAt)}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-foreground">{classroom.ownerName}</span>
                <span className="text-xs text-muted-foreground">{classroom.ownerEmail}</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <ClassroomRowActions classroom={classroom} onChanged={() => router.refresh()} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
