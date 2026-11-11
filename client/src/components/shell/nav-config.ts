import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarRange,
  CalendarX,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  Library,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { UserRole } from "@portal/shared/enums";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles that can see this item. Omit to show it to everyone. */
  roles?: UserRole[];
  /** Other path prefixes that belong to this item (header title, active state). */
  matches?: string[];
  /** Show a red dot while the user has unread notifications. */
  showUnreadDot?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
      { label: "Notifications", href: "/notifications", icon: Bell, showUnreadDot: true },
    ],
  },
  {
    label: "Schedule",
    items: [
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Timetable", href: "/timetable", icon: CalendarClock },
    ],
  },
  {
    label: "Learning",
    items: [
      {
        label: "To-do",
        href: "/todo",
        icon: ClipboardCheck,
        roles: [UserRole.STUDENT],
      },
      {
        label: "To review",
        href: "/review",
        icon: ClipboardList,
        roles: [UserRole.TEACHER, UserRole.ADMIN],
      },
      { label: "Classes", href: "/classes", icon: BookOpen },
      { label: "Archived classes", href: "/archived", icon: Archive },
    ],
  },
  {
    label: "University",
    items: [
      {
        label: "Programmes",
        href: "/admin/programmes",
        icon: GraduationCap,
        roles: [UserRole.ADMIN],
        matches: ["/admin/diplomas"],
      },
      { label: "Courses", href: "/admin/courses", icon: Library, roles: [UserRole.ADMIN] },
      {
        label: "Batches",
        href: "/admin/batches",
        icon: CalendarRange,
        roles: [UserRole.ADMIN],
        matches: ["/admin/sections"],
      },
    ],
  },
  {
    label: "Admin",
    items: [
      // No separate "Admin Dashboard" entry: "Dashboard" (/dashboard) already
      // shows admins the platform-wide dashboard, and /admin redirects there.
      { label: "Users", href: "/admin/users", icon: Users, roles: [UserRole.ADMIN] },
      {
        label: "Classrooms",
        href: "/admin/classrooms",
        icon: ShieldCheck,
        roles: [UserRole.ADMIN],
      },
      {
        label: "Timetable clashes",
        href: "/admin/timetable",
        icon: CalendarX,
        roles: [UserRole.ADMIN],
      },
      {
        label: "Audit Logs",
        href: "/admin/audit-logs",
        icon: ScrollText,
        roles: [UserRole.ADMIN],
      },
      // Platform settings are a section of /settings (shown to admins only),
      // so there's no separate admin nav entry for them.
    ],
  },
  {
    label: "Account",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export function getVisibleSections(role: UserRole): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Pages that aren't in the sidebar but still need a header title. */
const EXTRA_PAGE_TITLES: Record<string, string> = {
  "/profile": "Profile",
  "/change-password": "Change password",
  "/search": "Search",
};

/**
 * Title shown in the top header: the label of the most specific sidebar item
 * matching the current path (so /classes/123/stream reads "Classes"), or a
 * fixed title for the few pages outside the sidebar.
 */
export function getPageTitle(pathname: string, sections: NavSection[]): string | null {
  const match = sections
    .flatMap((section) => section.items)
    .filter((item) =>
      [item.href, ...(item.matches ?? [])].some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match?.label ?? EXTRA_PAGE_TITLES[pathname] ?? null;
}
