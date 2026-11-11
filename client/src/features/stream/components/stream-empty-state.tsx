import { Megaphone } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";

export function StreamEmptyState() {
  return (
    <EmptyState
      icon={Megaphone}
      title="No announcements yet"
      description="This is where your teacher will share updates, announcements, and class news."
    />
  );
}
