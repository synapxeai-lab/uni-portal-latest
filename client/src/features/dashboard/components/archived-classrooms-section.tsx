import Link from "@/components/ui/link";
import { ArrowRight } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";
import { ClassroomCard } from "@/features/classroom/components/classroom-card";
import type { ClassroomSummary } from "@/features/classroom/types";

const PREVIEW_LIMIT = 3;

/** Reuses the same ClassroomCard the full /archived page renders - no separate archived-card variant. */
export function ArchivedClassroomsSection({ classrooms }: { classrooms: ClassroomSummary[] }) {
  if (classrooms.length === 0) {
    return (
      <EmptyState
        title="No archived classes"
        description="Classes that get archived will show up here, read-only."
      />
    );
  }

  const preview = classrooms.slice(0, PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {preview.map((classroom) => (
          <ClassroomCard key={classroom.id} classroom={classroom} />
        ))}
      </div>
      {classrooms.length > PREVIEW_LIMIT ? (
        <Link href="/archived" className="group link-pill w-fit text-sm font-medium text-primary">
          View all {classrooms.length} archived classes{" "}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
