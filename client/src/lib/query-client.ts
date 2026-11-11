import { QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

/**
 * The one client-side data cache. Every page reads through it, so:
 * - revisiting a page within 30s renders instantly from cache with no request;
 * - after that, the cached page still renders instantly and refreshes in the
 *   background (stale-while-revalidate);
 * - nothing is ever fetched speculatively (no hover/viewport prefetching) -
 *   requests only happen when a page actually mounts.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx answers (not found, forbidden, signed out) won't change on retry.
        if (error instanceof AxiosError && error.response && error.response.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
