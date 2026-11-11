import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { LogoPlate } from "./logo-plate";
import type { NavSection } from "./nav-config";
import { NavList } from "./nav-list";
import { useSidebar } from "./sidebar-context";

const DEFAULT_PLATFORM_NAME = "Elevate Institute of Tourism & Hospitality Management";

/** Off-canvas navy drawer for <=768px, opened from the header's menu button. */
export function MobileNav({
  sections,
  homeHref = "/dashboard",
  platformName = DEFAULT_PLATFORM_NAME,
}: {
  sections: NavSection[];
  homeHref?: string;
  platformName?: string;
}) {
  const { isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side="left"
        data-sidebar
        className="w-[300px] max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground md:hidden [&>button:last-child]:right-3 [&>button:last-child]:top-3"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <LogoPlate homeHref={homeHref} platformName={platformName} />
        <div className="scrollbar-on-hover flex-1 overflow-y-auto">
          <NavList sections={sections} onNavigate={() => setMobileOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
