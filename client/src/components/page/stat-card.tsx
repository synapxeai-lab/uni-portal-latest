import Link from "@/components/ui/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardTone = "gold" | "neutral" | "info" | "success" | "warning" | "danger";

// Soft tinted tile + matching icon colour for each tone.
const TONE_CLASSES: Record<StatCardTone, string> = {
  gold: "bg-gold-soft text-navy dark:text-gold",
  neutral: "bg-muted text-foreground",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
  /** When set, the whole card navigates to this route - e.g. a "Users" count linking to /admin/users. */
  href?: string;
  /** Colour of the icon tile. Defaults to gold. */
  tone?: StatCardTone;
  /** Smaller tile, label and value - used by the dashboard's dense stat grid. */
  compact?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
  href,
  tone = "gold",
  compact = false,
}: StatCardProps) {
  const body = (
    // Icon tile, then an uppercase label over a large value. On small phones
    // the tile stacks above the text.
    <CardContent
      className={cn(
        "flex h-full items-center max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-3 max-[480px]:p-4",
        compact ? "min-h-[104px] gap-4 px-5 py-4" : "min-h-[136px] gap-[18px] p-6",
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            compact ? "h-10 w-10" : "h-12 w-12 rounded-xl",
            TONE_CLASSES[tone],
          )}
        >
          <Icon className={compact ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]"} aria-hidden />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p
          className={cn(
            "font-semibold uppercase leading-snug [overflow-wrap:anywhere]",
            compact
              ? "text-[11px] tracking-[0.04em] text-foreground"
              : "text-[13px] tracking-[0.02em] text-muted-foreground",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "truncate font-bold leading-none tabular-nums text-foreground",
            compact ? "text-[24px]" : "text-[30px] max-[480px]:text-[24px]",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-[0.8rem] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            {hint}
          </p>
        ) : null}
      </div>
    </CardContent>
  );

  const cardClassName = cn(
    "h-full rounded-lg",
    href
      ? "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
      : null,
    className,
  );

  if (href) {
    return (
      <Link href={href} className="block h-full rounded-lg" aria-label={`${label}: ${value}`}>
        <Card className={cardClassName}>{body}</Card>
      </Link>
    );
  }

  return <Card className={cardClassName}>{body}</Card>;
}
