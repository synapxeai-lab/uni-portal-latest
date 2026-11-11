import { Badge } from "@/components/ui/badge";

import {
  SUBMISSION_DISPLAY_STATUS_BADGE_VARIANT,
  SUBMISSION_DISPLAY_STATUS_LABEL,
  type SubmissionDisplayStatus,
} from "../lib/display-status";

interface SubmissionStatusBadgeProps {
  status: SubmissionDisplayStatus;
}

export function SubmissionStatusBadge({ status }: SubmissionStatusBadgeProps) {
  return (
    <Badge variant={SUBMISSION_DISPLAY_STATUS_BADGE_VARIANT[status]}>
      {SUBMISSION_DISPLAY_STATUS_LABEL[status]}
    </Badge>
  );
}
