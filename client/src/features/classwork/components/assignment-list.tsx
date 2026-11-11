import type { AssignmentSummary, TopicSummary } from "../types";
import { AssignmentCard } from "./assignment-card";

interface AssignmentListProps {
  assignments: AssignmentSummary[];
  classroomId: string;
  topics: TopicSummary[];
}

export function AssignmentList({ assignments, classroomId, topics }: AssignmentListProps) {
  if (assignments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {assignments.map((assignment) => (
        <AssignmentCard
          key={assignment.id}
          assignment={assignment}
          classroomId={classroomId}
          topics={topics}
        />
      ))}
    </div>
  );
}
