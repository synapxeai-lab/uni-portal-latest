import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

import { getClassroomAccent } from "../constants/classroom-colors";

interface ClassroomCoverProps {
  classroomId: string;
  title: string;
  section?: string | null;
  hasCoverImage?: boolean;
  /** Cards repeat the title in their body, so they render the banner without it. */
  showTitle?: boolean;
  className?: string;
}

export function ClassroomCover({
  classroomId,
  title,
  section,
  hasCoverImage,
  showTitle = true,
  className,
}: ClassroomCoverProps) {
  const accent = getClassroomAccent(classroomId);

  return (
    <div
      className={cn(
        "relative flex h-28 flex-col justify-end overflow-hidden rounded-t-xl p-4",
        hasCoverImage ? "bg-muted" : accent.bannerClassName,
        className,
      )}
    >
      {hasCoverImage ? (
        <>
          <img
            src={`/api/classrooms/${classroomId}/cover`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/85 via-navy-deep/35 to-transparent" />
        </>
      ) : (
        <GraduationCap className="absolute right-4 top-4 h-10 w-10 text-white/20" aria-hidden />
      )}
      {showTitle ? (
        <>
          <p className="relative truncate font-serif text-lg font-semibold text-white">{title}</p>
          {section ? <p className="relative truncate text-sm text-white/80">{section}</p> : null}
        </>
      ) : null}
    </div>
  );
}
