import Link from "@/components/ui/link";
import { usePathname } from "@/lib/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnreadCount } from "@/features/notifications/context/unread-count-context";
import { cn } from "@/lib/utils";

import type { NavSection } from "./nav-config";

interface NavListProps {
  sections: NavSection[];
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavList({ sections, collapsed = false, onNavigate }: NavListProps) {
  const pathname = usePathname();
  const unreadCount = useUnreadCount()?.count ?? 0;

  // Only the most specific matching link is active - otherwise a parent route
  // like /admin would light up alongside /admin/users.
  const matchesPath = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // An item also owns its `matches` prefixes (Programmes owns /admin/diplomas).
  const activeHref = sections
    .flatMap((section) =>
      section.items.flatMap((item) =>
        [item.href, ...(item.matches ?? [])].map((prefix) => ({ prefix, href: item.href })),
      ),
    )
    .filter(({ prefix }) => matchesPath(prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.href;

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 px-3 pb-6 pt-[18px]">
      {sections.map((section, sectionIndex) => (
        <div key={section.label ?? sectionIndex} className="flex flex-col gap-1">
          {section.label ? (
            collapsed ? (
              // Collapsed rail: section names become a thin divider.
              <div aria-hidden className="mx-3 my-2 h-px bg-sidebar-border" />
            ) : (
              <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-sidebar-muted">
                {section.label}
              </p>
            )
          ) : null}
          {section.items.map((item) => {
            const isActive = item.href === activeHref;
            const Icon = item.icon;
            const showDot = Boolean(item.showUnreadDot) && unreadCount > 0;

            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 items-center gap-3.5 rounded-lg px-4 text-[18px] font-medium leading-tight transition-colors duration-150 outline-none",
                  collapsed && "justify-center px-0",
                  // Active route: gold text on a gold-tinted row plus a 3px gold
                  // bar on the left edge - the bar and aria-current carry the
                  // state, not colour alone.
                  isActive
                    ? "bg-sidebar-active font-semibold text-sidebar-primary before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-r-[3px] before:bg-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <span className="flex w-[22px] shrink-0 items-center justify-center">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {showDot ? (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full bg-gold ring-2 ring-sidebar",
                        collapsed ? "absolute right-5 top-3" : "ml-auto",
                      )}
                    />
                    <span className="sr-only">(unread)</span>
                  </>
                ) : null}
              </Link>
            );

            if (!collapsed) {
              return link;
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
