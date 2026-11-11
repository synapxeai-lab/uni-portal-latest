import Link from "@/components/ui/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DashboardSectionLink {
  href: string;
  label: string;
}

interface DashboardSectionProps {
  title: string;
  description?: string;
  /** Optional "view all"-style links shown at the right of the heading row. */
  links?: DashboardSectionLink[];
  children: ReactNode;
  className?: string;
}

/** Shared heading + content block used by the student, teacher, and admin dashboards. */
export function DashboardSection({
  title,
  description,
  links,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-primary dark:text-foreground">
            <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {links && links.length > 0 ? (
          <div className="flex flex-wrap items-center gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group link-pill text-sm font-medium text-link dark:text-gold"
              >
                {link.label}{" "}
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
