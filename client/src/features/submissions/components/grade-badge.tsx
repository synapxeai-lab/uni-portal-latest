import { Badge } from "@/components/ui/badge";

import { formatGrade } from "../lib/format-grade";

interface GradeBadgeProps {
  grade: number | null;
  maxPoints: number | null;
}

export function GradeBadge({ grade, maxPoints }: GradeBadgeProps) {
  return (
    <Badge variant={grade === null ? "outline" : "default"}>{formatGrade(grade, maxPoints)}</Badge>
  );
}
