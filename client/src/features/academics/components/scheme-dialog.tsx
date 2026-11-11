import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import { universityAction } from "../api";
import { categoryLabel } from "../lib/marks";
import type { CourseDetail } from "../types";
import { runAction } from "./ui";

interface Entry {
  id?: number;
  type: string;
  component: "THEORY" | "PRACTICAL";
  weightage: number;
}

/**
 * The course's assessment scheme: its theory/practical split and the
 * assessment sections every class section of the course is marked in.
 */
export function SchemeDialog({ course, open, onOpenChange }: { course: CourseDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [theory, setTheory] = useState(course.theoryPercent);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTheory(course.theoryPercent);
      setEntries(course.assessmentScheme.map((e) => ({ ...e, type: e.type })));
    }
  }, [open, course]);

  const totals = {
    THEORY: entries.filter((e) => e.component === "THEORY").reduce((s, e) => s + (e.weightage || 0), 0),
    PRACTICAL: entries.filter((e) => e.component === "PRACTICAL").reduce((s, e) => s + (e.weightage || 0), 0),
  };
  const update = (index: number, patch: Partial<Entry>) =>
    setEntries((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assessment scheme · {course.code}</DialogTitle>
          <DialogDescription>
            Theory sections can total up to the theory share, practical ones the rest. Teachers mark students in these sections.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="theory-share">Theory share (%)</Label>
          <Input id="theory-share" type="number" min={0} max={100} className="w-28" value={theory} onChange={(e) => setTheory(Number(e.target.value))} />
          <p className="text-xs text-muted-foreground">
            Theory {totals.THEORY}/{theory}% · Practical {totals.PRACTICAL}/{100 - theory}%
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {entries.map((entry, index) => (
            <div key={entry.id ?? `new-${index}`} className="grid grid-cols-[1fr_120px_80px_auto] items-center gap-2">
              <Input
                aria-label="Assessment name"
                value={categoryLabel(entry.type) === entry.type ? entry.type : categoryLabel(entry.type)}
                onChange={(e) => update(index, { type: e.target.value })}
              />
              <Select aria-label="Theory or practical" value={entry.component} onChange={(e) => update(index, { component: e.target.value as Entry["component"] })}>
                <option value="THEORY">Theory</option>
                <option value="PRACTICAL">Practical</option>
              </Select>
              <Input
                aria-label="Weightage"
                type="number"
                min={0}
                max={100}
                value={entry.weightage}
                onChange={(e) => update(index, { weightage: Number(e.target.value) })}
              />
              <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setEntries((c) => c.filter((_, i) => i !== index))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="self-start"
            onClick={() => setEntries((c) => [...c, { type: "", component: theory > 0 ? "THEORY" : "PRACTICAL", weightage: 10 }])}
          >
            <Plus /> Add section
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              // Built-in codes keep their code when their label is unchanged (Quizzes -> QUIZ).
              const toCode = (entry: Entry) => {
                const original = course.assessmentScheme.find((e) => e.id === entry.id);
                return original && categoryLabel(original.type) === entry.type ? original.type : entry.type;
              };
              const ok = await runAction(
                universityAction("put", `/courses/${course.id}/assessment-scheme`, {
                  theoryPercent: theory,
                  entries: entries.map((e) => ({ ...e, type: toCode(e) })),
                }),
              );
              setSaving(false);
              if (ok) onOpenChange(false);
            }}
          >
            Save scheme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
