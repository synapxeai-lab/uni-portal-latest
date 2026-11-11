import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SystemSettings } from "@/lib/system-settings";
import type { ActionResult } from "@/types/action-result";

import { updateSettingsAction } from "../api";

const initialState: ActionResult<SystemSettings> | null = null;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

function SettingsCheckbox({
  id,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 rounded-lg border border-border p-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ settings }: { settings: SystemSettings }) {
  const [state, formAction, isPending] = useActionState(updateSettingsAction, initialState);

  useEffect(() => {
    if (!state) {
      return;
    }
    if (state.status === "success") {
      toast.success("Settings saved.");
    } else if (!state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  const current = state?.status === "success" ? state.data : settings;
  const fieldErrors = state?.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform identity</CardTitle>
          <CardDescription>Shown across the app header and page titles.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="platformName">Platform name</Label>
            <Input
              id="platformName"
              name="platformName"
              defaultValue={current.platformName}
              required
            />
            <FieldError messages={fieldErrors?.platformName} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="academicYear">Academic year</Label>
            <Input
              id="academicYear"
              name="academicYear"
              defaultValue={current.academicYear}
              placeholder="2025-2026"
              required
            />
            <FieldError messages={fieldErrors?.academicYear} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security & uploads</CardTitle>
          <CardDescription>Session length and the largest file users may upload.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sessionTimeoutMinutes">Session timeout (minutes)</Label>
            <Input
              id="sessionTimeoutMinutes"
              name="sessionTimeoutMinutes"
              type="number"
              min={5}
              max={1440}
              defaultValue={current.sessionTimeoutMinutes}
              required
            />
            <FieldError messages={fieldErrors?.sessionTimeoutMinutes} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxUploadSizeMb">Max upload size (MB)</Label>
            <Input
              id="maxUploadSizeMb"
              name="maxUploadSizeMb"
              type="number"
              min={1}
              max={500}
              defaultValue={current.maxUploadSizeMb}
              required
            />
            <FieldError messages={fieldErrors?.maxUploadSizeMb} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password policy</CardTitle>
          <CardDescription>
            Requirements enforced when any user sets a new password.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="minPasswordLength">Minimum length</Label>
            <Input
              id="minPasswordLength"
              name="minPasswordLength"
              type="number"
              min={6}
              max={72}
              defaultValue={current.minPasswordLength}
              required
            />
            <FieldError messages={fieldErrors?.minPasswordLength} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SettingsCheckbox
              id="requirePasswordUppercase"
              label="Require uppercase"
              description="At least one uppercase letter."
              defaultChecked={current.requirePasswordUppercase}
            />
            <SettingsCheckbox
              id="requirePasswordNumber"
              label="Require number"
              description="At least one digit."
              defaultChecked={current.requirePasswordNumber}
            />
            <SettingsCheckbox
              id="requirePasswordSymbol"
              label="Require symbol"
              description="At least one non-alphanumeric character."
              defaultChecked={current.requirePasswordSymbol}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default classroom settings</CardTitle>
          <CardDescription>Applied automatically to every newly created classroom.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsCheckbox
            id="defaultAllowComments"
            label="Allow comments"
            description="Students can comment on posts."
            defaultChecked={current.defaultAllowComments}
          />
          <SettingsCheckbox
            id="defaultAllowMaterials"
            label="Allow materials"
            description="Teachers can post materials."
            defaultChecked={current.defaultAllowMaterials}
          />
          <SettingsCheckbox
            id="defaultAllowAssignments"
            label="Allow assignments"
            description="Teachers can post assignments."
            defaultChecked={current.defaultAllowAssignments}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification defaults</CardTitle>
          <CardDescription>Which events generate a notification platform-wide.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SettingsCheckbox
            id="notifyNewAssignment"
            label="New assignment"
            description="Notify students when an assignment is posted."
            defaultChecked={current.notifyNewAssignment}
          />
          <SettingsCheckbox
            id="notifyNewMaterial"
            label="New material"
            description="Notify students when a material is posted."
            defaultChecked={current.notifyNewMaterial}
          />
          <SettingsCheckbox
            id="notifyNewAnnouncement"
            label="New announcement"
            description="Notify students of new announcements."
            defaultChecked={current.notifyNewAnnouncement}
          />
          <SettingsCheckbox
            id="notifySubmissionReturned"
            label="Submission returned"
            description="Notify students when work is graded and returned."
            defaultChecked={current.notifySubmissionReturned}
          />
          <SettingsCheckbox
            id="notifyPrivateComment"
            label="Private comment"
            description="Notify on new private (teacher-student) comments."
            defaultChecked={current.notifyPrivateComment}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
