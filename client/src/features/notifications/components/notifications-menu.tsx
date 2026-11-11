import { useState } from "react";
import Link from "@/components/ui/link";
import { Bell, Check } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { useNotifications } from "../hooks/use-notifications";
import { NotificationItem } from "./notification-item";

interface NotificationsMenuProps {
  initialUnreadCount: number;
}

export function NotificationsMenu({ initialUnreadCount }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    nextCursor,
    isLoading,
    isLoadingMore,
    error,
    hasLoadedOnce,
    load,
    loadMore,
    markRead,
    markAllRead,
    remove,
  } = useNotifications({ initialUnreadCount });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      load();
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-none text-gold-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <div className="flex items-center justify-between px-2.5 pt-1">
          <DropdownMenuLabel className="px-0 text-sm font-semibold text-foreground">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead()}
            >
              <Check className="h-3 w-3" aria-hidden /> Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-[60vh] overflow-y-auto p-1">
          {isLoading && !hasLoadedOnce ? (
            <div className="flex flex-col gap-3 p-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Couldn't load notifications"
              description={error}
              onRetry={load}
              className="border-none p-4 shadow-none"
            />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description="New notifications about your classes will show up here."
              className="border-none p-4 shadow-none"
            />
          ) : (
            <div className="flex flex-col gap-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markRead}
                  onRemove={remove}
                />
              ))}
              {nextCursor ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-xs"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <DropdownMenuSeparator />
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="link-pill flex w-full justify-center py-2 text-xs font-medium text-primary"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
