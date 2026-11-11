import type { ReactNode } from "react";
import { usePathname } from "@/lib/navigation";
import { signOut } from "@/lib/auth";
import { LogOut, Menu, Search } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSearchDialog } from "@/features/search/context/search-dialog-context";
import { NotificationsMenu } from "@/features/notifications/components/notifications-menu";

import { getPageTitle, type NavSection } from "./nav-config";
import { SearchBar } from "./search-bar";
import { useSidebar } from "./sidebar-context";
import { UserMenu, type ShellUser } from "./user-menu";

/**
 * The white top bar shared by the app and admin shells: 80px (60px on
 * phones), page title on the left, account cluster on the right - name and
 * email, avatar menu, a divider and a Sign out button. `actions` slots in
 * shell-specific controls (search, notifications) before the account cluster.
 */
export function HeaderBar({
  user,
  sections,
  fallbackTitle,
  titleAdornment,
  center,
  actions,
}: {
  user: ShellUser;
  sections: NavSection[];
  fallbackTitle: string;
  titleAdornment?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebar();
  const title = getPageTitle(pathname, sections) ?? fallbackTitle;

  return (
    <header className="sticky top-0 z-40 flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:h-[80px] md:pl-10 md:pr-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        className="-ml-2 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-[18px] w-[18px]" />
      </Button>
      <div className="flex min-w-0 items-center gap-3">
        <p className="truncate font-heading text-[18px] font-bold leading-tight text-foreground md:text-[24px]">
          {title}
        </p>
        {titleAdornment}
      </div>
      <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">{center}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
        {actions}
        {/* Hidden below lg: beside the 300px sidebar there isn't room for it. */}
        <div className="hidden min-w-0 flex-col items-end leading-tight lg:flex">
          <span className="max-w-[200px] truncate text-[16px] font-semibold text-foreground">
            {user.name ?? "Unnamed user"}
          </span>
          {user.email ? (
            <span className="max-w-[200px] truncate text-[14px] text-muted-foreground">
              {user.email}
            </span>
          ) : null}
        </div>
        <UserMenu user={user} />
        <span aria-hidden className="hidden h-[26px] w-px bg-border min-[481px]:block" />
        <Button
          variant="outline"
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="h-[42px] rounded-lg px-3 text-[15px] max-md:h-9"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span className="hidden min-[481px]:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}

export function Header({
  user,
  sections,
  initialUnreadCount,
}: {
  user: ShellUser;
  sections: NavSection[];
  initialUnreadCount: number;
}) {
  const { setOpen: setSearchOpen } = useSearchDialog();

  return (
    <HeaderBar
      user={user}
      sections={sections}
      fallbackTitle="Home"
      center={<SearchBar className="max-w-md" />}
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            className="lg:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>
          <ThemeToggle />
          <NotificationsMenu initialUnreadCount={initialUnreadCount} />
        </>
      }
    />
  );
}
