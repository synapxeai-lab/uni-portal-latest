import { useQuery } from "@tanstack/react-query";

import type { ClassroomSummary } from "@/features/classroom/types";
import { apiGet } from "@/lib/api";

import type { AdminDashboardData, StudentDashboardData, TeacherDashboardData } from "./types";

export type DashboardResponse =
  | { role: "ADMIN"; data: AdminDashboardData }
  | { role: "TEACHER"; data: TeacherDashboardData }
  | { role: "STUDENT"; data: StudentDashboardData; classrooms: ClassroomSummary[] };

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardResponse>("/dashboard"),
  });
}
