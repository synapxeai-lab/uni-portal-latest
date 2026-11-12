import type { SubmissionOverview } from "../types";

interface SubmissionStatsRowProps {
  overview: SubmissionOverview;
}

export function SubmissionStatsRow({ overview }: SubmissionStatsRowProps) {
  const stats: { label: string; value: number }[] = [
    { label: "Total students", value: overview.totalStudents },
    { label: "Submitted", value: overview.submitted },
    { label: "Not submitted", value: overview.notSubmitted },
    { label: "Missing", value: overview.missing },
    { label: "Late", value: overview.late },
    { label: "Graded", value: overview.graded },
    { label: "Returned for revision", value: overview.returned },
  ];

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col">
          <span className="text-lg font-semibold text-foreground">{stat.value}</span>
          <span className="text-xs text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
