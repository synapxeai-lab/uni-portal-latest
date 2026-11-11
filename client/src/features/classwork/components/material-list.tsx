import type { MaterialSummary, TopicSummary } from "../types";
import { MaterialCard } from "./material-card";

interface MaterialListProps {
  materials: MaterialSummary[];
  classroomId: string;
  topics: TopicSummary[];
}

export function MaterialList({ materials, classroomId, topics }: MaterialListProps) {
  if (materials.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {materials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          classroomId={classroomId}
          topics={topics}
        />
      ))}
    </div>
  );
}
