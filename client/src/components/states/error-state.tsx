import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Couldn't load this data",
  description = "We couldn't load this page. Try again in a moment.",
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    // White card, error border with a 4px red left edge, warning icon beside the text.
    <div
      role="alert"
      className={cn(
        "flex items-start gap-4 rounded-xl border border-destructive-border border-l-4 border-l-destructive bg-card p-5",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-[0.82rem] text-mid-foreground">{description}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-3 self-start">
            <RefreshCw className="h-4 w-4" />
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
