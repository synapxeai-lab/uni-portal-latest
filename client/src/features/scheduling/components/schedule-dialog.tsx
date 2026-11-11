import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Label } from "@/components/ui/label";
import { useTimeZone } from "@/components/providers/time-zone-provider";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime/format";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValue?: Date | null;
  pending?: boolean;
  /** Receives the picked time as an ISO instant, already resolved in the viewer's zone. */
  onConfirm: (scheduledFor: string) => void;
}

/**
 * Shared reschedule dialog used from every management menu's "Schedule…"
 * item (existing draft content, not the create-time flow - see
 * PublishControls for that).
 */
export function ScheduleDialog({
  open,
  onOpenChange,
  defaultValue,
  pending,
  onConfirm,
}: ScheduleDialogProps) {
  const timeZone = useTimeZone();
  const [value, setValue] = useState(() => toDateTimeInputValue(defaultValue, timeZone));
  const scheduledFor = fromDateTimeInputValue(value, timeZone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule publication</DialogTitle>
          <DialogDescription>Choose when this becomes visible to students.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="schedule-dialog-datetime">Publish date &amp; time</Label>
          <DateTimeInput
            id="schedule-dialog-datetime"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => scheduledFor && onConfirm(scheduledFor.toISOString())}
            disabled={pending || !scheduledFor}
          >
            {pending ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
