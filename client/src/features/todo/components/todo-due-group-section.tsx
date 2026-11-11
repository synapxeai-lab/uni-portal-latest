import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { TodoAssignmentCard } from "./todo-assignment-card";
import { TODO_DUE_GROUP_LABEL } from "../lib/todo-display";
import type { TodoAssignmentItem, TodoDueGroup } from "../types";

interface TodoDueGroupSectionProps {
  group: TodoDueGroup;
  items: TodoAssignmentItem[];
}

/** One collapsible due-date section within a tab - hides itself entirely when empty, shows a live count, and remembers its own open/closed state independent of every other section. Label-left/count-and-chevron-right row, matching Google Classroom's own To-do layout. */
export function TodoDueGroupSection({ group, items }: TodoDueGroupSectionProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="text-base text-foreground">{TODO_DUE_GROUP_LABEL[group]}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary">{items.length}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !expanded && "-rotate-90",
            )}
            aria-hidden
          />
        </span>
      </button>
      {expanded ? (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <TodoAssignmentCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
