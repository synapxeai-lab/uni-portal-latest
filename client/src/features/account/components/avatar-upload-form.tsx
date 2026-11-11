import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import type { ActionResult } from "@/types/action-result";

import { updateAvatarAction } from "../api";

const initialState: ActionResult<undefined> | null = null;

interface AvatarUploadFormProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * The one editable field on the Profile page - name/email are assigned by
 * an admin and read-only everywhere else on the page, this is deliberately
 * the only form here.
 */
export function AvatarUploadForm({ name, email, avatarUrl }: AvatarUploadFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateAvatarAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const initials = getInitials(name, email);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.status === "success") {
      toast.success("Profile photo updated");
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-5">
      <Avatar className="h-20 w-20">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
        <AvatarFallback className="text-xl">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <label htmlFor="avatar" className="text-sm font-medium text-foreground">
          Profile photo
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          disabled={isPending}
          className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
        />
        <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, or WebP - up to 5MB.</p>
        <Button type="submit" size="sm" className="w-fit" disabled={isPending}>
          {isPending ? "Uploading…" : "Save photo"}
        </Button>
      </div>
    </form>
  );
}
