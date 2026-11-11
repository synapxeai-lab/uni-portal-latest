import { useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/types/action-result";

/**
 * Wraps a fire-and-forget Server Action call (not bound to a <form>) with
 * pending state and toast feedback on failure, so callers only handle success.
 */
export function usePendingAction<T>(
  action: () => Promise<ActionResult<T>>,
  onSuccess?: (data: T) => void,
) {
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await action();

      if (result.status === "success") {
        onSuccess?.(result.data);
      } else {
        toast.error(result.message);
      }
    });
  }

  return { run, isPending };
}
