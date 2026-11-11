import { type FormEvent, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { TopicSummary } from "../types";

interface TopicRowProps {
  topic: TopicSummary;
  canManage: boolean;
  sortable?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (title: string) => void;
  onDelete?: () => void;
}

export function TopicRow({
  topic,
  canManage,
  sortable = false,
  isEditing = false,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: TopicRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
    disabled: !sortable,
  });

  const style = sortable ? { transform: CSS.Transform.toString(transform), transition } : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();

    if (title) {
      onSaveEdit?.(title);
    }
  }

  return (
    <div
      ref={sortable ? setNodeRef : undefined}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border border-b-2 border-b-gold/70 bg-card px-3 py-2.5",
        isDragging && "z-10 shadow-md",
      )}
    >
      {sortable ? (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${topic.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
          <Input
            name="title"
            defaultValue={topic.title}
            autoFocus
            maxLength={100}
            className="h-8"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onCancelEdit?.();
              }
            }}
          />
          <Button type="submit" size="sm">
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <p className="flex-1 truncate text-base font-semibold text-primary dark:text-foreground">
            {topic.title}
          </p>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Options for ${topic.title}`}
                  className="h-8 w-8 shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onStartEdit}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this topic?"
        description={`"${topic.title}" will be removed from Classwork. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setDeleteOpen(false);
          onDelete?.();
        }}
      />
    </div>
  );
}
