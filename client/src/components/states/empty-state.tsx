import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        // Dashed placeholder card with a muted icon above muted text.
        "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-8 py-12 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-8 w-8 text-faint-foreground" aria-hidden /> : null}
      <div className="flex flex-col gap-1">
        <p className="text-[0.875rem] font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-[0.875rem] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
