import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageContainer } from "@/components/page/page-container";
import { SectionHeader } from "@/components/page/section-header";
import { ListSkeleton, PageHeaderSkeleton } from "@/components/states/skeletons";
import { openNotifications } from "@/features/notifications/api";
import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { UNREAD_COUNT_QUERY_KEY } from "@/features/notifications/context/unread-count-context";
import { QueryView } from "@/app/route-states";

function NotificationsLoading() {
  return (
    <PageContainer>
      <PageHeaderSkeleton />
      <ListSkeleton rows={6} />
    </PageContainer>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  // Opening this page counts as reading everything: every visit marks all
  // read (staleTime 0) and the sidebar dot / bell badge clear immediately.
  const page = useQuery({
    queryKey: ["notifications", "page"],
    queryFn: () => openNotifications({ limit: 20 }),
    staleTime: 0,
  });

  useEffect(() => {
    if (page.isSuccess) {
      queryClient.setQueryData(UNREAD_COUNT_QUERY_KEY, 0);
    }
  }, [page.isSuccess, page.dataUpdatedAt, queryClient]);

  return (
    <QueryView query={page} loading={<NotificationsLoading />}>
      {(initialPage) => (
        <PageContainer>
          <SectionHeader
            title="Notifications"
            description="Updates from your classes, all in one place."
          />
          <NotificationCenter
            // Remount with fresh state whenever the page data is reloaded.
            key={page.dataUpdatedAt}
            initialNotifications={initialPage.notifications}
            initialCursor={initialPage.nextCursor}
          />
        </PageContainer>
      )}
    </QueryView>
  );
}
