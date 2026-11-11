import Link from "@/components/ui/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { useSidebar } from "./sidebar-context";

/**
 * Top of the navy sidebar: the EITHM logo on a white "plate" (the artwork has
 * an opaque white background, so it never sits directly on navy) with a 3px
 * gold underline. Matches the 80px header height. The collapsed rail shows
 * the crest only. Holds the desktop collapse toggle when collapsing is allowed.
 */
export function LogoPlate({
  homeHref,
  platformName,
  collapsed = false,
  showCollapseToggle = false,
}: {
  homeHref: string;
  platformName: string;
  collapsed?: boolean;
  showCollapseToggle?: boolean;
}) {
  const { toggleCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "relative flex min-h-[60px] shrink-0 items-center border-b-[3px] border-gold bg-white md:min-h-[80px]",
        collapsed ? "justify-center px-2" : "gap-2 px-4",
      )}
    >
      <Link
        href={homeHref}
        aria-label={`${platformName} - Home`}
        className="flex min-w-0 items-center rounded-md"
      >
        {collapsed ? (
          <img src="/brand/logo.png" alt="" width={32} height={32} className="h-9 w-9" />
        ) : (
          <img
            src="/brand/eithm-pk.png"
            alt=""
            width={1620}
            height={580}
            fetchPriority="high"
            className="h-[44px] w-auto md:h-[58px]"
          />
        )}
      </Link>
      {showCollapseToggle ? (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-border bg-white text-navy transition-colors duration-150 hover:border-gold hover:bg-gold-soft",
            // Collapsed: the plate is only 88px wide, so the toggle hangs off
            // the rail's right edge instead of sitting beside the crest.
            collapsed ? "absolute -right-[17px] top-1/2 z-10 -translate-y-1/2" : "ml-auto",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}
