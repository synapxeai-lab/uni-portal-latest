import { startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "@/lib/navigation";
import { Plus, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ClassroomFormDialog } from "./classroom-form-dialog";
import { JoinClassroomDialog } from "./join-classroom-dialog";

export function ClassesPageActions({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("code") ?? undefined;
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  // Held in state because the URL is cleaned up (router.replace below) before
  // the dialog mounts - reading it from searchParams would leave the field empty.
  const [prefilledCode, setPrefilledCode] = useState<string>();

  // A shared invite link (see InvitationDialog) lands here as /classes?code=...
  // - pop the Join dialog pre-filled instead of silently auto-joining, since
  // joining is a real mutation that should still take an explicit click.
  useEffect(() => {
    if (inviteCode) {
      startTransition(() => {
        setPrefilledCode(inviteCode);
        setJoinOpen(true);
      });
      router.replace("/classes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode]);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => {
          setPrefilledCode(undefined);
          setJoinOpen(true);
        }}
      >
        <UsersRound /> Join class
      </Button>
      {canCreate ? (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> Create class
        </Button>
      ) : null}

      {canCreate ? (
        <ClassroomFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
      ) : null}
      <JoinClassroomDialog open={joinOpen} onOpenChange={setJoinOpen} defaultCode={prefilledCode} />
    </div>
  );
}
