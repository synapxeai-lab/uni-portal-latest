import { getVisibleSections } from "@/components/shell/nav-config";
import { UserRole } from "@portal/shared/enums";

// Every /admin/* route is already gated to ADMIN-only by admin/layout.tsx, so
// the admin chrome uses a fixed role rather than needing the current user.
export const adminSections = getVisibleSections(UserRole.ADMIN);
