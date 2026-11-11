import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ActionResult } from "@portal/shared/action-result";

import { apiAction, apiGet } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

import type {
  BatchDetail,
  Course,
  CourseDetail,
  Department,
  ProgrammeCategory,
  SectionDetail,
} from "./types";

/**
 * Every academic record query lives under the "university" key, so one
 * mutation can refresh them all - the server invalidates its cache the same
 * way (CacheTags.UNIVERSITY).
 */
export const UNIVERSITY_KEY = "university";

/** GET hook for one university endpoint; `path` is also the cache key. */
export function useUniversityQuery<T>(path: string | null, options: { keepPrevious?: boolean } = {}) {
  return useQuery({
    queryKey: [UNIVERSITY_KEY, path],
    queryFn: () => apiGet<T>(path!),
    enabled: path !== null,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}

/** A university mutation; refreshes every university query on success. */
export async function universityAction<T = { message?: string }>(
  method: "post" | "put" | "patch" | "delete",
  url: string,
  body?: unknown,
): Promise<ActionResult<T>> {
  const result = await apiAction<T>(method, url, body);
  if (result.status === "success") {
    await queryClient.invalidateQueries({ queryKey: [UNIVERSITY_KEY] });
  }
  return result;
}

/** Builds "?a=1&b=x" from the defined, non-empty values. */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// ---- Typed read hooks -----------------------------------------------------------------

export const useProgrammeCategories = () =>
  useUniversityQuery<{ categories: ProgrammeCategory[] }>("/programme-categories");

export const useBatches = () => useUniversityQuery<{ batches: string[]; details: BatchDetail[] }>("/batches");

export const useDepartments = (params: { category?: string; search?: string } = {}) =>
  useUniversityQuery<{ departments: Department[] }>(`/departments${queryString(params)}`, {
    keepPrevious: true,
  });

export const useDepartment = (id: number) =>
  useUniversityQuery<{ department: Department }>(`/departments/${id}`);

export const useCourses = (params: Record<string, string | number | undefined>) =>
  useUniversityQuery<{ courses: Course[] }>(`/courses${queryString(params)}`, { keepPrevious: true });

export const useCourse = (id: number) => useUniversityQuery<{ course: CourseDetail }>(`/courses/${id}`);

export const useSection = (id: number) =>
  useUniversityQuery<{ section: SectionDetail }>(`/sections/${id}`);

/** The programme record for a key (e.g. "CPD"), from the cached list. */
export function useProgrammeLookup() {
  const categories = useProgrammeCategories().data?.categories ?? [];
  return (key: string | null | undefined) => categories.find((category) => category.key === key);
}
