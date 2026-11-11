import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { changeMemberRoleAction, leaveClassroomAction, removeMemberAction } from "../api";
import { canManageClassroom } from "../lib/can-manage";
import {
  filterMembers,
  sortMembers,
  type MemberSortKey,
  type SortDirection,
} from "../lib/roster-search-sort";
import type { ClassroomMembershipRole, ClassroomMemberSummary, ClassroomRoster } from "../types";
import { MemberActionsMenu } from "./member-actions-menu";
import { RosterControls } from "./roster-controls";
import { RosterSection } from "./roster-section";

type RosterOptimisticAction =
  | { type: "remove"; userId: string }
  | { type: "changeRole"; userId: string; role: ClassroomMembershipRole };

function rebucket(members: ClassroomMemberSummary[]): ClassroomRoster {
  return {
    teachers: members.filter((member) => canManageClassroom(member.role)),
    students: members.filter((member) => !canManageClassroom(member.role)),
  };
}

function rosterReducer(state: ClassroomRoster, action: RosterOptimisticAction): ClassroomRoster {
  const allMembers = [...state.teachers, ...state.students];

  if (action.type === "remove") {
    return rebucket(allMembers.filter((member) => member.id !== action.userId));
  }

  return rebucket(
    allMembers.map((member) =>
      member.id === action.userId ? { ...member, role: action.role } : member,
    ),
  );
}

interface RoleChangeTarget {
  member: ClassroomMemberSummary;
  newRole: ClassroomMembershipRole;
}

function roleChangeCopy(target: RoleChangeTarget, classroomTitle: string) {
  if (target.newRole === "OWNER") {
    return {
      title: `Transfer ownership to ${target.member.name}?`,
      description: `${target.member.name} will become the owner of ${classroomTitle}, and you'll become a teacher. Only the new owner will be able to transfer it again.`,
      destructive: true,
    };
  }

  if (target.newRole === "CO_TEACHER") {
    return {
      title: `Make ${target.member.name} a co-teacher?`,
      description: `${target.member.name} will be able to manage ${classroomTitle}, including classwork, the roster, and grades.`,
      destructive: false,
    };
  }

  return {
    title: `Remove ${target.member.name} as co-teacher?`,
    description: `${target.member.name} will become a student and lose management access to ${classroomTitle}.`,
    destructive: true,
  };
}

interface RosterManagerProps {
  classroomId: string;
  classroomTitle: string;
  ownerId: string;
  initialRoster: ClassroomRoster;
  viewerId: string;
  canManage: boolean;
}

export function RosterManager({
  classroomId,
  classroomTitle,
  ownerId,
  initialRoster,
  viewerId,
  canManage,
}: RosterManagerProps) {
  const router = useRouter();
  const [optimisticRoster, applyOptimistic] = useOptimistic(initialRoster, rosterReducer);
  const [removeTarget, setRemoveTarget] = useState<ClassroomMemberSummary | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();
  const [roleChangeTarget, setRoleChangeTarget] = useState<RoleChangeTarget | null>(null);
  const [isChangingRole, startRoleChangeTransition] = useTransition();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isLeaving, startLeaveTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<MemberSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const isViewerOwner = viewerId === ownerId;
  const isSearching = search.trim().length > 0;

  const visibleTeachers = useMemo(
    () => sortMembers(filterMembers(optimisticRoster.teachers, search), sortKey, sortDir),
    [optimisticRoster.teachers, search, sortKey, sortDir],
  );
  const visibleStudents = useMemo(
    () => sortMembers(filterMembers(optimisticRoster.students, search), sortKey, sortDir),
    [optimisticRoster.students, search, sortKey, sortDir],
  );

  function handleRemoveConfirm() {
    const target = removeTarget;
    if (!target) {
      return;
    }

    startRemoveTransition(async () => {
      applyOptimistic({ type: "remove", userId: target.id });

      const result = await removeMemberAction(classroomId, target.id);

      if (result.status === "success") {
        toast.success(`${target.name} removed from ${classroomTitle}`);
        setRemoveTarget(null);
      } else {
        toast.error(result.message);
      }

      // Reconciles the optimistic state with the server either way: on
      // success this re-fetches the roster without the removed member; on
      // failure it re-fetches the original roster, undoing the optimistic removal.
      router.refresh();
    });
  }

  function handleRoleChangeConfirm() {
    const target = roleChangeTarget;
    if (!target) {
      return;
    }

    startRoleChangeTransition(async () => {
      applyOptimistic({ type: "changeRole", userId: target.member.id, role: target.newRole });
      if (target.newRole === "OWNER") {
        // Ownership transfer swaps two roles at once - reflect both immediately.
        applyOptimistic({ type: "changeRole", userId: viewerId, role: "TEACHER" });
      }

      const result = await changeMemberRoleAction(classroomId, target.member.id, target.newRole);

      if (result.status === "success") {
        toast.success(
          target.newRole === "OWNER"
            ? `Ownership transferred to ${target.member.name}`
            : `${target.member.name}'s role updated`,
        );
        setRoleChangeTarget(null);
      } else {
        toast.error(result.message);
      }

      router.refresh();
    });
  }

  function handleLeaveConfirm() {
    startLeaveTransition(async () => {
      const result = await leaveClassroomAction(classroomId);

      if (result.status === "success") {
        toast.success(`Left ${classroomTitle}`);
        router.push("/classes");
      } else {
        toast.error(result.message);
        setLeaveOpen(false);
      }
    });
  }

  function renderMemberActions(member: ClassroomMemberSummary) {
    if (!canManage || member.role === "OWNER" || member.id === viewerId) {
      return null;
    }

    return (
      <MemberActionsMenu
        member={member}
        isViewerOwner={isViewerOwner}
        onChangeRole={(target, newRole) => setRoleChangeTarget({ member: target, newRole })}
        onRemove={setRemoveTarget}
      />
    );
  }

  const roleChangeDetails = roleChangeTarget
    ? roleChangeCopy(roleChangeTarget, classroomTitle)
    : null;

  return (
    <>
      <RosterControls
        search={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        sortDir={sortDir}
        onToggleSortDir={() => setSortDir((previous) => (previous === "asc" ? "desc" : "asc"))}
      />

      <RosterSection
        title="Teachers"
        members={visibleTeachers}
        emptyMessage={isSearching ? "No teachers match your search." : "No teachers found."}
        renderAction={renderMemberActions}
      />
      <RosterSection
        title="Students"
        members={visibleStudents}
        emptyMessage={
          isSearching ? "No students match your search." : "No students have joined this class yet."
        }
        renderAction={renderMemberActions}
      />

      {!canManage ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit text-destructive hover:text-destructive"
          onClick={() => setLeaveOpen(true)}
        >
          <LogOut /> Leave class
        </Button>
      ) : null}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
          }
        }}
        title={`Remove ${removeTarget?.name ?? "this member"}?`}
        description={`${removeTarget?.name ?? "They"} will lose access to ${classroomTitle} immediately. They can rejoin later with the class code.`}
        confirmLabel="Remove"
        destructive
        pending={isRemoving}
        onConfirm={handleRemoveConfirm}
      />

      <ConfirmDialog
        open={roleChangeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleChangeTarget(null);
          }
        }}
        title={roleChangeDetails?.title ?? "Change this member's role?"}
        description={roleChangeDetails?.description ?? ""}
        confirmLabel={roleChangeTarget?.newRole === "OWNER" ? "Transfer ownership" : "Confirm"}
        destructive={roleChangeDetails?.destructive}
        pending={isChangingRole}
        onConfirm={handleRoleChangeConfirm}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this class?"
        description={`You'll need the class code to rejoin ${classroomTitle} later.`}
        confirmLabel="Leave"
        destructive
        pending={isLeaving}
        onConfirm={handleLeaveConfirm}
      />
    </>
  );
}
