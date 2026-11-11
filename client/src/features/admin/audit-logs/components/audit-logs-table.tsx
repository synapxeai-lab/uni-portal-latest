import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { AuditLogEntry } from "../types";

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

const actionBadgeVariant: Record<string, NonNullable<BadgeProps["variant"]>> = {
  "User Created": "default",
  "User Updated": "outline",
  "Password Reset": "outline",
  "Role Changed": "secondary",
  "User Suspended": "destructive",
  "Classroom Archived": "secondary",
  "Assignment Deleted": "destructive",
  "Announcement Deleted": "destructive",
};

export function AuditLogsTable({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-muted-foreground">
              {dateFormatter.format(entry.createdAt)}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{entry.actorName}</span>
                <span className="text-xs text-muted-foreground">{entry.actorEmail}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-foreground">{entry.targetLabel}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.entityType}
                  {entry.classroomTitle ? ` · ${entry.classroomTitle}` : ""}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={actionBadgeVariant[entry.actionLabel] ?? "outline"}>
                {entry.actionLabel}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
