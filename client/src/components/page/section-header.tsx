import type { ReactNode } from "react";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/shell/breadcrumbs";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  breadcrumbsHomeHref?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  breadcrumbs,
  breadcrumbsHomeHref,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} homeHref={breadcrumbsHomeHref} />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-[1.25rem] font-extrabold leading-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="text-[0.8rem] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
