import type { TodoCategory, TodoDueGroup } from "../types";

export const TODO_CATEGORY_LABEL: Record<TodoCategory, string> = {
  assigned: "Assigned",
  missing: "Missing",
  done: "Done",
};

export const TODO_DUE_GROUP_LABEL: Record<TodoDueGroup, string> = {
  "no-due-date": "No due date",
  "this-week": "This week",
  "next-week": "Next week",
  later: "Later",
};

export const TODO_CATEGORY_EMPTY_COPY: Record<
  TodoCategory,
  { title: string; description: string }
> = {
  assigned: {
    title: "Nothing assigned",
    description: "Work that's due soon will show up here once your teachers publish it.",
  },
  missing: {
    title: "Nothing missing",
    description: "You're caught up - nothing overdue and unsubmitted right now.",
  },
  done: {
    title: "Nothing turned in yet",
    description: "Assignments you've submitted, including graded and returned work, show up here.",
  },
};
