import { Sidebar } from "@/components/shell/sidebar";

import { adminSections } from "./admin-sections";

// Same Sidebar component and nav config the shared Shell uses, so the
// sidebar's contents never change depending on which shell is mounted. The
// home link is /dashboard here too. Collapsing is disabled in the admin shell
// (SidebarProvider forceExpanded), which hides the collapse toggle.
export function AdminSidebar({ platformName }: { platformName?: string }) {
  return <Sidebar sections={adminSections} platformName={platformName} />;
}
