import { useMemo } from "react";
import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from "react-router";

import { queryClient } from "./query-client";

/**
 * The small slice of the next/navigation API the UI components use, backed by
 * React Router - so components moved over from the Next.js app keep their
 * code. `refresh()` (which re-rendered server data in Next) invalidates the
 * query cache: pages on screen refetch, everything else refetches when next
 * visited.
 */
export function useRouter() {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      push: (href: string, options?: { scroll?: boolean }) => {
        navigate(href, { preventScrollReset: options?.scroll === false });
      },
      replace: (href: string, options?: { scroll?: boolean }) => {
        navigate(href, { replace: true, preventScrollReset: options?.scroll === false });
      },
      back: () => navigate(-1),
      refresh: () => {
        void queryClient.invalidateQueries();
      },
    }),
    [navigate],
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

/** Read-only, like Next's ReadonlyURLSearchParams. */
export function useSearchParams(): URLSearchParams {
  return useRouterSearchParams()[0];
}

export function useParams<T extends Record<string, string>>(): T {
  return useRouterParams() as T;
}
