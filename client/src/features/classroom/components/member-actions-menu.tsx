import { Crown, MoreVertical, ShieldCheck, ShieldMinus, UserMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ClassroomMembershipRole, ClassroomMemberSummary } from "../types";

interface MemberActionsMenuProps {
  member: ClassroomMemberSummary;
  isViewerOwner: boolean;
  onChangeRole: (member: ClassroomMemberSummary, newRole: ClassroomMembershipRole) => void;
  onRemove: (member: ClassroomMemberSummary) => void;
}

export function MemberActionsMenu({
  member,
  isViewerOwner,
  onChangeRole,
  onRemove,
}: MemberActionsMenuProps) {
  const canPromoteToCoTeacher = member.role === "STUDENT";
  const canDemoteToStudent = member.role === "CO_TEACHER";
  const canTransferOwnership =
    isViewerOwner && (member.role === "TEACHER" || member.role === "CO_TEACHER");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={`Actions for ${member.name}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPromoteToCoTeacher ? (
          <DropdownMenuItem onSelect={() => onChangeRole(member, "CO_TEACHER")}>
            <ShieldCheck /> Make co-teacher
          </DropdownMenuItem>
        ) : null}
        {canDemoteToStudent ? (
          <DropdownMenuItem onSelect={() => onChangeRole(member, "STUDENT")}>
            <ShieldMinus /> Remove as co-teacher
          </DropdownMenuItem>
        ) : null}
        {canTransferOwnership ? (
          <DropdownMenuItem onSelect={() => onChangeRole(member, "OWNER")}>
            <Crown /> Make owner
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onRemove(member)}
          className="text-destructive focus:text-destructive"
        >
          <UserMinus /> Remove from class
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
