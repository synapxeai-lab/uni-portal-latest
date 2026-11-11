import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";

import type { TodoAssignmentItem, TodoClassroomOption } from "./types";

export function useTodoBoard(classroomId: string | undefined) {
  return useQuery({
    queryKey: ["todo", classroomId ?? "all"],
    queryFn: () =>
      apiGet<{ items: TodoAssignmentItem[]; classrooms: TodoClassroomOption[] }>("/todo", {
        params: { classroomId },
      }),
    // Switching the class filter keeps the current board on screen until the new one arrives.
    placeholderData: keepPreviousData,
  });
}
