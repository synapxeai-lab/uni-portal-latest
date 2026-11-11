import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import type { ActionResult } from "@portal/shared/action-result";
import { TIME_ZONE_HEADER } from "@portal/shared/datetime/time-zone";

import { browserTimeZone } from "./time-zone";

// ISO-8601 instants exactly as JSON.stringify(Date) writes them. Revived to
// Date objects so components keep working with real Dates, as they did when
// the server rendered them.
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === "string" && ISO_INSTANT.test(value) ? new Date(value) : value;
}

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    // Required by the server's CSRF guard on every state-changing request.
    "X-Requested-With": "portal",
    [TIME_ZONE_HEADER]: browserTimeZone(),
  },
  transformResponse: [
    (data: unknown) => {
      if (typeof data !== "string" || data.length === 0) {
        return data;
      }
      try {
        return JSON.parse(data, reviveDates);
      } catch {
        return data;
      }
    },
  ],
});

export interface ApiErrorBody {
  status: "error";
  message: string;
  code?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
}

export function getApiError(error: unknown): ApiErrorBody | null {
  if (
    error instanceof AxiosError &&
    error.response?.data &&
    typeof error.response.data === "object"
  ) {
    const body = error.response.data as Partial<ApiErrorBody>;
    if (typeof body.message === "string") {
      return {
        status: "error",
        message: body.message,
        code: body.code,
        fieldErrors: body.fieldErrors,
      };
    }
  }
  return null;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 404;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 403;
}

/** GET returning the response body; throws on failure (for useQuery). */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<T>(url, config);
  return response.data;
}

const FALLBACK_ERROR = "Something went wrong. Please try again.";

function toErrorResult<T>(error: unknown, fallbackMessage = FALLBACK_ERROR): ActionResult<T> {
  const body = getApiError(error);
  if (body) {
    return { status: "error", message: body.message, fieldErrors: body.fieldErrors };
  }
  if (error instanceof AxiosError && !error.response) {
    return { status: "error", message: "Can't reach the server. Check your connection." };
  }
  return { status: "error", message: fallbackMessage };
}

type Method = "post" | "put" | "patch" | "delete";

/**
 * A mutation call that resolves to an ActionResult instead of throwing - the
 * exact contract the old Server Actions had, so forms built on
 * useActionState / usePendingAction work unchanged.
 */
export async function apiAction<T = undefined>(
  method: Method,
  url: string,
  body?: unknown,
  fallbackMessage?: string,
): Promise<ActionResult<T>> {
  try {
    const response = await api.request<ActionResult<T>>({ method, url, data: body });
    return response.data;
  } catch (error) {
    return toErrorResult<T>(error, fallbackMessage);
  }
}

/** FormData -> plain object (string fields only - file fields are left out). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}
