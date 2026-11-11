import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CreateUserDialog } from "./create-user-dialog";
import { TemporaryPasswordDialog } from "./temporary-password-dialog";
import type { CreatedUserResult } from "../types";

export function CreateUserButton() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<CreatedUserResult | null>(null);

  function handleCreated(result: CreatedUserResult) {
    setCreated(result);
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => setDialogOpen(true)}>
        <Plus /> Create user
      </Button>
      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={handleCreated} />
      {created ? (
        <TemporaryPasswordDialog
          open={created !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCreated(null);
            }
          }}
          userName={created.user.name}
          temporaryPassword={created.temporaryPassword}
        />
      ) : null}
    </>
  );
}
