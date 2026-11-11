import { MobileNav } from "@/components/shell/mobile-nav";

import { adminSections } from "./admin-sections";

export function AdminMobileNav({ platformName }: { platformName?: string }) {
  return <MobileNav sections={adminSections} platformName={platformName} />;
}
