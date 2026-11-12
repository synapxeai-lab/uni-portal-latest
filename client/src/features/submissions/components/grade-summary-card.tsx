import { GraduationCap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { GradeSummary } from "../types";

interface GradeSummaryCardProps {
  summary: GradeSummary;
  maxPoints: number | null;
}

function formatStat(value: number | null, maxPoints: number | null): string {
  if (value === null) {
    return "—";
  }

  return maxPoints !== null
    ? `${Math.round(value * 10) / 10}/${maxPoints}`
    : `${Math.round(value * 10) / 10}`;
}

export function GradeSummaryCard({ summary, maxPoints }: GradeSummaryCardProps) {
  const stats: { label: string; value: string }[] = [
    { label: "Average", value: formatStat(summary.averageGrade, maxPoints) },
    { label: "Highest", value: formatStat(summary.highestGrade, maxPoints) },
    { label: "Lowest", value: formatStat(summary.lowestGrade, maxPoints) },
    { label: "Graded", value: String(summary.gradedCount) },
    { label: "Pending", value: String(summary.pendingCount) },
    { label: "Returned for revision", value: String(summary.returnedCount) },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle>Grades</CardTitle>
      </CardHeader>
      <CardContent>
        {maxPoints === null ? (
          <p className="text-sm text-muted-foreground">
            This assignment has no maximum points, so it can&apos;t be graded numerically.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span className="text-lg font-semibold text-foreground">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
