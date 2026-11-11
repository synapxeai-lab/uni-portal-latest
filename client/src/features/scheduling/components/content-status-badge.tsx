import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { DateTimeText } from "@/components/ui/date-time-text";

interface ContentStatusBadgeProps {
  status: string;
  scheduledFor?: Date | null;
}

/** Shared Draft/Scheduled badge for announcement, assignment, and material cards. Published content shows no badge (existing convention). */
export function ContentStatusBadge({ status, scheduledFor }: ContentStatusBadgeProps) {
  if (status === "PUBLISHED") {
    return null;
  }

  if (status === "CLOSED") {
    return <Badge variant="secondary">Closed</Badge>;
  }

  if (status === "SCHEDULED") {
    return (
      <Badge variant="gold" className="gap-1">
        <CalendarClock className="h-3 w-3" aria-hidden />
        {scheduledFor ? (
          <>
            Scheduled · <DateTimeText value={scheduledFor} />
          </>
        ) : (
          "Scheduled"
        )}
      </Badge>
    );
  }

  return <Badge variant="outline">Draft</Badge>;
}
