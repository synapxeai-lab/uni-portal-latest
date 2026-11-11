import { useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateTimeText } from "@/components/ui/date-time-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";

import { createPrivateCommentAction, deletePrivateCommentAction } from "../api";
import type { PrivateCommentSummary } from "../types";

interface PrivateCommentPanelProps {
  classroomId: string;
  assignmentId: string;
  studentId: string;
  initialComments: PrivateCommentSummary[];
  canComment: boolean;
  visibilityNote: string;
  disabledNote: string;
}

export function PrivateCommentPanel({
  classroomId,
  assignmentId,
  studentId,
  initialComments,
  canComment,
  visibilityNote,
  disabledNote,
}: PrivateCommentPanelProps) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState("");
  const [isPosting, startPostTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handlePost() {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    startPostTransition(async () => {
      const result = await createPrivateCommentAction(
        classroomId,
        assignmentId,
        studentId,
        trimmed,
      );

      if (result.status === "success") {
        setComments((previous) => [...previous, result.data]);
        setContent("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete(commentId: string) {
    setDeletingId(commentId);

    startDeleteTransition(async () => {
      const result = await deletePrivateCommentAction(
        classroomId,
        assignmentId,
        studentId,
        commentId,
      );

      if (result.status === "success") {
        setComments((previous) => previous.filter((comment) => comment.id !== commentId));
        router.refresh();
      } else {
        toast.error(result.message);
      }

      setDeletingId(null);
    });
  }

  return (
    <Card>
      <CardHeader className="gap-1 space-y-0">
        <CardTitle>Private comments</CardTitle>
        <CardDescription>{visibilityNote}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {comments.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {comments.map((comment) => (
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
                      {comment.author.isTeacher ? (
                        <span className="ml-1 font-normal text-muted-foreground">(Teacher)</span>
                      ) : null}
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      <DateTimeText value={comment.createdAt} variant="relative" />
                    </p>
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
                    disabled={isDeleting && deletingId === comment.id}
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No private comments yet.</p>
        )}

        {canComment ? (
          <div className="flex items-center gap-2">
            <Input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Add a private comment…"
              maxLength={5000}
              className="h-9"
              disabled={isPosting}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handlePost();
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Post comment"
              disabled={isPosting}
              onClick={handlePost}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{disabledNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
