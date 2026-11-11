import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Cake,
  ChefHat,
  Coffee,
  ConciergeBell,
  GraduationCap,
  Hotel,
  Layers,
  Palette,
  Utensils,
  Wine,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@portal/shared/action-result";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Programme icon names stored on ProgrammeCategory.icon (see the server's programme-service). */
export const PROGRAMME_ICONS: Record<string, LucideIcon> = {
  "chef-hat": ChefHat,
  cake: Cake,
  coffee: Coffee,
  wine: Wine,
  utensils: Utensils,
  "concierge-bell": ConciergeBell,
  hotel: Hotel,
  briefcase: Briefcase,
  palette: Palette,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  layers: Layers,
};

export function ProgrammeIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && PROGRAMME_ICONS[name]) || GraduationCap;
  return <Icon className={className} aria-hidden />;
}

/** A coloured square tile with an icon, using a record's own colour pair. */
export function ColourTile({
  color,
  bg,
  children,
  className,
}: {
  color: string;
  bg: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5", className)}
      style={{ color, background: bg }}
    >
      {children}
    </div>
  );
}

export function formatRs(amount: number | null | undefined): string {
  return `Rs. ${(amount ?? 0).toLocaleString("en-PK")}`;
}

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** A card wrapping a table, scrolling sideways on narrow screens. */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

/** A small labelled value, for detail headers. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/** Runs a mutation and toasts its message or error; resolves true on success. */
export async function runAction(action: Promise<ActionResult<unknown>>, fallback?: string): Promise<boolean> {
  const result = await action;
  if (result.status === "success") {
    const message = (result.data as { message?: string } | undefined)?.message ?? fallback;
    if (message) {
      toast.success(message);
    }
    return true;
  }
  toast.error(result.message);
  return false;
}
