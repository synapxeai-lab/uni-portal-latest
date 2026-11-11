import { cn } from "@/lib/utils";

import { LogoPlate } from "./logo-plate";
import type { NavSection } from "./nav-config";
import { NavList } from "./nav-list";
import { useSidebar } from "./sidebar-context";

const DEFAULT_PLATFORM_NAME = "Elevate Institute of Tourism & Hospitality Management";

/**
 * Desktop navy sidebar (>=769px): full viewport height, 300px wide or an
 * 88px rail when collapsed. Below that the MobileNav drawer takes over.
 */
export function Sidebar({
  sections,
  homeHref = "/dashboard",
  platformName = DEFAULT_PLATFORM_NAME,
}: {
  sections: NavSection[];
  homeHref?: string;
  platformName?: string;
}) {
  const { isCollapsed, canCollapse } = useSidebar();

  return (
    <aside
      data-sidebar
      className={cn(
        "sticky top-0 hidden h-screen h-dvh shrink-0 flex-col self-start bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        isCollapsed ? "w-[88px]" : "w-[300px]",
      )}
    >
      <LogoPlate
        homeHref={homeHref}
        platformName={platformName}
        collapsed={isCollapsed}
        showCollapseToggle={canCollapse}
      />
      <div className="scrollbar-on-hover flex-1 overflow-y-auto">
        <NavList sections={sections} collapsed={isCollapsed} />
      </div>
    </aside>
  );
}
