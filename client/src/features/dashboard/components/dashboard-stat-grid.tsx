import type { ReactNode } from "react";

/**
 * Flat, ungrouped grid of compact stat cards. Columns are sized from the
 * available width (not the viewport) so the sidebar never squeezes cards
 * below a readable width; 2 across on small phones, 1 on the narrowest.
 */
export function DashboardStatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13.5rem),1fr))] gap-4 max-[480px]:grid-cols-2 max-[480px]:gap-3 max-[360px]:grid-cols-1">
      {children}
    </div>
  );
}
