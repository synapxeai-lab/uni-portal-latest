import { useEffect, useState, useTransition } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";

import { getUserDetailAction } from "../api";
import {
  roleBadgeVariant,
  roleLabels,
  statusBadgeVariant,
  statusLabels,
} from "../lib/user-display";
import type { AdminUserDetail, AdminUserSummary } from "../types";

interface UserDetailsSheetProps {
  user: AdminUserSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function UserDetailsSheet({ user, open, onOpenChange }: UserDetailsSheetProps) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    startTransition(async () => {
      setDetail(null);
      const result = await getUserDetailAction(user.id);
      setDetail(result);
    });
  }, [open, user.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm sm:max-w-md">
        <SheetHeader>
          <SheetTitle>User details</SheetTitle>
          <SheetDescription>Account information for {user.name}.</SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
            <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{user.name}</span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={roleBadgeVariant[user.role]}>{roleLabels[user.role]}</Badge>
          <Badge variant={statusBadgeVariant[user.status]}>{statusLabels[user.status]}</Badge>
          {user.mustChangePassword ? <Badge variant="outline">Must change password</Badge> : null}
        </div>

        <Separator />

        {isPending || !detail ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Owned classrooms</dt>
              <dd className="font-medium text-foreground">{detail.ownedClassroomCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Classroom memberships</dt>
              <dd className="font-medium text-foreground">{detail.classroomMembershipCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email verified</dt>
              <dd className="font-medium text-foreground">
                {detail.emailVerified ? dateFormatter.format(detail.emailVerified) : "Not verified"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium text-foreground">
                {dateFormatter.format(detail.createdAt)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="font-medium text-foreground">
                {dateFormatter.format(detail.updatedAt)}
              </dd>
            </div>
            {detail.archivedAt ? (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Archived</dt>
                <dd className="font-medium text-foreground">
                  {dateFormatter.format(detail.archivedAt)}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  );
}
