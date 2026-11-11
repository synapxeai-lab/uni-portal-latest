import { type FormEvent, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateTimeText } from "@/components/ui/date-time-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";

import { createCommentAction, deleteCommentAction } from "../api";
import type { CommentSummary } from "../types";
import { NewStreamItemBadge } from "./stream-freshness";

interface CommentThreadProps {
  classroomId: string;
  announcementId: string;
  comments: CommentSummary[];
  currentUser: { id: string; name: string; image: string | null };
  archived?: boolean;
}

type OptimisticAction =
  { type: "add"; comment: CommentSummary } | { type: "remove"; commentId: string };

export function CommentThread({
  classroomId,
  announcementId,
  comments,
  currentUser,
  archived = false,
}: CommentThreadProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [, startTransition] = useTransition();
  const [optimisticComments, applyOptimistic] = useOptimistic(
    comments,
    (state: CommentSummary[], action: OptimisticAction) => {
      if (action.type === "add") {
        return [...state, action.comment];
      }
      return state.filter((comment) => comment.id !== action.commentId);
    },
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setContent("");

    startTransition(async () => {
      applyOptimistic({
        type: "add",
        comment: {
          id: `optimistic-${Date.now()}`,
          content: trimmed,
          createdAt: new Date(),
          author: currentUser,
          canDelete: true,
        },
      });

      const formData = new FormData();
      formData.set("classroomId", classroomId);
      formData.set("announcementId", announcementId);
      formData.set("content", trimmed);

      const result = await createCommentAction(null, formData);

      if (result.status === "success") {
        router.refresh();
      } else {
        setContent(trimmed);
        toast.error(result.message);
      }
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      applyOptimistic({ type: "remove", commentId });

      const result = await deleteCommentAction(classroomId, commentId);

      if (result.status === "success") {
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {optimisticComments.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {optimisticComments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2.5">
              <Avatar className="h-7 w-7">
                {comment.author.image ? (
                  <AvatarImage src={comment.author.image} alt={comment.author.name} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {getInitials(comment.author.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {comment.author.name}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    <DateTimeText value={comment.createdAt} variant="relative" />
                  </p>
                  <NewStreamItemBadge itemId={comment.id} authorId={comment.author.id} />
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{comment.content}</p>
              </div>
              {comment.canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete comment"
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No comments yet</p>
      )}

      {archived ? (
        <p className="text-xs text-muted-foreground">
          Comments are turned off because this class is archived.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            {currentUser.image ? (
              <AvatarImage src={currentUser.image} alt={currentUser.name} />
            ) : null}
            <AvatarFallback className="text-xs">{getInitials(currentUser.name)}</AvatarFallback>
          </Avatar>
          <Input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Add class comment…"
            maxLength={2000}
            className="h-9"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Post comment"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
