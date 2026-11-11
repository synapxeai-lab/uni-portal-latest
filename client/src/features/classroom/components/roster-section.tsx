import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

import type { ClassroomMemberSummary } from "../types";
import { RosterMemberRow } from "./roster-member-row";

interface RosterSectionProps {
  title: string;
  members: ClassroomMemberSummary[];
  emptyMessage: string;
  renderAction?: (member: ClassroomMemberSummary) => ReactNode;
}

export function RosterSection({ title, members, emptyMessage, renderAction }: RosterSectionProps) {
  const headingId = `roster-section-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{members.length}</span>
      </div>
      <Card>
        {members.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {members.map((member) => (
              <RosterMemberRow key={member.id} member={member} action={renderAction?.(member)} />
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
