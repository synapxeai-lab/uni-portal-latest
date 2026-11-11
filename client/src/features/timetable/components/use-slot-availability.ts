import { useEffect, useState } from "react";

import type { ActionResult, SlotHourAvailability } from "../types";

interface Loaded {
  key: string;
  hours: SlotHourAvailability[] | null;
  error: string | null;
}

/**
 * Loads the per-hour availability for whatever (class, date) the form currently
 * points at. `key` identifies the request; `load` is only called when `key` is
 * non-null. "Loading" is derived (the loaded key doesn't match the current one)
 * rather than stored, and a stale response for an older key is simply ignored.
 */
export function useSlotAvailability(
  key: string | null,
  load: () => Promise<ActionResult<SlotHourAvailability[]>>,
) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!key) {
      return;
    }

    let cancelled = false;
    load()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setLoaded(
          result.status === "success"
            ? { key, hours: result.data, error: null }
            : { key, hours: null, error: result.message },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({ key, hours: null, error: "Couldn't load slot availability." });
        }
      });

    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure every render; `key` fully identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = key && loaded?.key === key ? loaded : null;

  return {
    loading: key !== null && current === null,
    hours: current?.hours ?? null,
    error: current?.error ?? null,
  };
}
