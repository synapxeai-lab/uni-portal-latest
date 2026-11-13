import type { ReactNode } from "react";

import { BackButton } from "@/components/page/back-button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/shell/breadcrumbs";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  breadcrumbsHomeHref?: string;
  actions?: ReactNode;
  /** The page's Back button; false for a header that isn't the page's own (a section inside a page). */
  back?: boolean;
  className?: string;
}

/** Where Back goes when there's no earlier page: the nearest linked breadcrumb, else home. */
function parentOf(here: string, breadcrumbs: BreadcrumbItem[] | undefined, home: string) {
  const linked = (breadcrumbs ?? []).filter((b) => b.href && b.href !== here);
  return linked.at(-1)?.href ?? home;
}

export function SectionHeader({
  title,
  description,
  breadcrumbs,
  breadcrumbsHomeHref,
  actions,
  back = true,
  className,
}: SectionHeaderProps) {
  const { pathname, search } = useLocation();
  const hasBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {back || hasBreadcrumbs ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {back ? <BackButton fallback={parentOf(pathname + search, breadcrumbs, breadcrumbsHomeHref ?? "/dashboard")} /> : null}
          {hasBreadcrumbs ? <Breadcrumbs items={breadcrumbs!} homeHref={breadcrumbsHomeHref} /> : null}
        </div>
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
