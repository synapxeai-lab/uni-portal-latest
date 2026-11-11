import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";

export function TopicEmptyState({ canManage }: { canManage: boolean }) {
  return (
    <EmptyState
      icon={ClipboardList}
      title="No topics yet"
      description={
        canManage
          ? "Create a topic to start organizing classwork for this class."
          : "Your teacher hasn't added any topics yet."
      }
    />
  );
}
