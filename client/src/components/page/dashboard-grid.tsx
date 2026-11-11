import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DashboardGridProps {
  children: ReactNode;
  className?: string;
}

export function DashboardGrid({ children, className }: DashboardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface StatGridProps {
  children: ReactNode;
  className?: string;
}

export function StatGrid({ children, className }: StatGridProps) {
  return (
    // Stat tiles: auto-fit 320px columns; 2 across on small phones, 1 on the narrowest.
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4 max-[600px]:grid-cols-2 max-[380px]:grid-cols-1",
        className,
      )}
    >
      {children}
    </div>
  );
}
