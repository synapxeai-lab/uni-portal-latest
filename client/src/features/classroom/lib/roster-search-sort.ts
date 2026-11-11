import type { ClassroomMemberSummary } from "../types";

export type MemberSortKey = "name" | "joinedAt";
export type SortDirection = "asc" | "desc";

export function filterMembers(
  members: ClassroomMemberSummary[],
  search: string,
): ClassroomMemberSummary[] {
  const term = search.trim().toLowerCase();

  if (!term) {
    return members;
  }

  return members.filter(
    (member) =>
      member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term),
  );
}

export function sortMembers(
  members: ClassroomMemberSummary[],
  sortKey: MemberSortKey,
  sortDir: SortDirection,
): ClassroomMemberSummary[] {
  const sorted = [...members].sort((a, b) =>
    sortKey === "joinedAt"
      ? a.joinedAt.getTime() - b.joinedAt.getTime()
      : a.name.localeCompare(b.name),
  );

  return sortDir === "asc" ? sorted : sorted.reverse();
}
