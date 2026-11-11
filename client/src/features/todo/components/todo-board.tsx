import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";

import { TodoDueGroupSection } from "./todo-due-group-section";
import { TODO_CATEGORY_EMPTY_COPY, TODO_CATEGORY_LABEL } from "../lib/todo-display";
import {
  TODO_CATEGORIES,
  TODO_DUE_GROUPS,
  type TodoAssignmentItem,
  type TodoCategory,
} from "../types";

interface TodoBoardProps {
  items: TodoAssignmentItem[];
  /** Seeds which tab is active, e.g. from a dashboard "Missing assignments" link's ?tab= query param. */
  initialTab?: TodoCategory;
}

/**
 * Owns tab selection and delegates per-section collapse state to
 * TodoDueGroupSection. All three tabs' data already arrives pre-categorized
 * from the server in one request (see todo-service.ts), so switching tabs
 * here is instant, local UI state - no re-fetch, no navigation - the same
 * reasoning that keeps collapse/expand local rather than URL-driven (aside
 * from the initial tab, which a caller may seed from the URL).
 */
export function TodoBoard({ items, initialTab = "assigned" }: TodoBoardProps) {
  const [activeTab, setActiveTab] = useState<TodoCategory>(initialTab);

  const countsByCategory = useMemo(() => {
    const counts: Record<TodoCategory, number> = { assigned: 0, missing: 0, done: 0 };
    for (const item of items) {
      counts[item.category] += 1;
    }
    return counts;
  }, [items]);

  const groupedActiveItems = useMemo(() => {
    const activeItems = items.filter((item) => item.category === activeTab);
    return TODO_DUE_GROUPS.map((group) => ({
      group,
      items: activeItems.filter((item) => item.dueGroup === group),
    }));
  }, [items, activeTab]);

  const activeCount = countsByCategory[activeTab];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="To-do category"
        className="flex items-center gap-6 border-b border-border"
      >
        {TODO_CATEGORIES.map((category) => {
          const active = activeTab === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(category)}
              className={cn(
                "-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-1.5">
                {TODO_CATEGORY_LABEL[category]}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
                    category === "missing" && countsByCategory.missing > 0
                      ? "bg-destructive-soft text-destructive"
                      : "bg-muted text-muted-foreground",
                  )}
                  aria-label={`${countsByCategory[category]} ${TODO_CATEGORY_LABEL[category].toLowerCase()}`}
                >
                  {countsByCategory[category]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {activeCount === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={TODO_CATEGORY_EMPTY_COPY[activeTab].title}
          description={TODO_CATEGORY_EMPTY_COPY[activeTab].description}
        />
      ) : (
        <div className="flex flex-col">
          {groupedActiveItems.map(({ group, items: groupItems }) => (
            <TodoDueGroupSection key={group} group={group} items={groupItems} />
          ))}
        </div>
      )}
    </div>
  );
}
