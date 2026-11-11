import { useOptimistic, useTransition } from "react";
import Link from "@/components/ui/link";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

import { setUserStatusAction } from "../api";
import {
  roleBadgeVariant,
  roleLabels,
  statusBadgeVariant,
  statusLabels,
} from "../lib/user-display";
import type { AdminUserSummary, SortDirection, UserSortField } from "../types";
import { UserRowActions } from "./user-row-actions";

type UsersAction =
  | { type: "setStatus"; userId: string; status: AdminUserSummary["status"] }
  | { type: "update"; user: AdminUserSummary };

function usersReducer(state: AdminUserSummary[], action: UsersAction): AdminUserSummary[] {
  if (action.type === "setStatus") {
    return state.map((user) =>
      user.id === action.userId ? { ...user, status: action.status } : user,
    );
  }

  return state.map((user) => (user.id === action.user.id ? action.user : user));
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const columns: { field: UserSortField; label: string }[] = [
  { field: "name", label: "Name" },
  { field: "email", label: "Email" },
  { field: "role", label: "Role" },
  { field: "status", label: "Status" },
  { field: "createdAt", label: "Created" },
];

interface UsersTableProps {
  users: AdminUserSummary[];
  currentUserId: string;
  sortField?: UserSortField;
  sortDir: SortDirection;
}

export function UsersTable({ users, currentUserId, sortField, sortDir }: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [optimisticUsers, applyOptimistic] = useOptimistic(users, usersReducer);
  const [, startTransition] = useTransition();

  function sortHref(field: UserSortField): string {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir: SortDirection = sortField === field && sortDir === "asc" ? "desc" : "asc";
    params.set("sort", `${field}:${nextDir}`);
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  function handleStatusChange(
    userId: string,
    status: AdminUserSummary["status"],
    toastLabel: string,
  ) {
    startTransition(async () => {
      applyOptimistic({ type: "setStatus", userId, status });

      const result = await setUserStatusAction(userId, status);

      if (result.status === "success") {
        toast.success(toastLabel);
      } else {
        toast.error(result.message);
      }

      router.refresh();
    });
  }

  function handleUpdated(user: AdminUserSummary) {
    applyOptimistic({ type: "update", user });
    router.refresh();
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
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {optimisticUsers.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                  <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{user.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              <Badge variant={roleBadgeVariant[user.role]}>{roleLabels[user.role]}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant[user.status]}>{statusLabels[user.status]}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {dateFormatter.format(user.createdAt)}
            </TableCell>
            <TableCell className="text-right">
              <UserRowActions
                user={user}
                isSelf={user.id === currentUserId}
                onStatusChange={handleStatusChange}
                onUpdated={handleUpdated}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
