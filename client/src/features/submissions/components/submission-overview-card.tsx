import Link from "@/components/ui/link";
import { ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { SubmissionOverview } from "../types";
import { SubmissionStatsRow } from "./submission-stats-row";

interface SubmissionOverviewCardProps {
  classroomId: string;
  assignmentId: string;
  overview: SubmissionOverview;
}

export function SubmissionOverviewCard({
  classroomId,
  assignmentId,
  overview,
}: SubmissionOverviewCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <CardTitle>Submissions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SubmissionStatsRow overview={overview} />
        <Button asChild className="w-fit">
          <Link href={`/classes/${classroomId}/classwork/${assignmentId}/submissions`}>
            View submissions
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
