import { useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import {
  ClassicButton,
  ClassicModal,
  FieldError,
  FieldHint,
  FormGroup,
  FormLabel,
  inputErrorClass,
  ModalActions,
} from "@/components/classic/classic";
import { cn } from "@/lib/utils";

import { useProgrammeLookup, useUniversityQuery } from "../api";

interface TeacherOption {
  id: number;
  name: string;
  email: string;
  programme: string;
}

/**
 * The old University Portal's AssignTeacherModal: a searchable teacher picker,
 * the given programme's teachers listed first. `onAssign` returns an error
 * message to show, or null once assigned.
 */
export function ClassicAssignTeacherModal({
  title,
  programme,
  onClose,
  onAssign,
}: {
  title: string;
  programme?: string;
  onClose: () => void;
  onAssign: (teacherId: number) => Promise<string | null>;
}) {
  const query = useUniversityQuery<{ teachers: TeacherOption[] }>("/teachers");
  const programmeOf = useProgrammeLookup();
  const teachers = query.data?.teachers ?? [];
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = teachers
    .filter((t) => t.name.toLowerCase().includes(q))
    .sort((a, b) => (programme ? Number(b.programme === programme) - Number(a.programme === programme) : 0));
  const shortLabel = (key: string) => programmeOf(key)?.label.replace(/ Programmes?$/i, "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!teacherId) return setError(search.trim() ? "Select a teacher from the list" : "Teacher is required");
    setSaving(true);
    const failed = await onAssign(teacherId);
    setSaving(false);
    if (failed) setError(failed);
  }

  return (
    <ClassicModal open onClose={onClose} title={`Assign Teacher — ${title}`}>
      <form onSubmit={submit} noValidate>
        <FormGroup className="relative">
          <FormLabel htmlFor="assign-teacher" required>
            Teacher
          </FormLabel>
          {query.isPending ? (
            <FieldHint>Loading teachers…</FieldHint>
          ) : query.isError ? (
            <FieldError>Failed to load teachers.</FieldError>
          ) : teachers.length === 0 ? (
            <FieldHint>No teachers found. Add one from the Teachers page first.</FieldHint>
          ) : (
            <>
              <Input
                id="assign-teacher"
                type="text"
                value={search}
                placeholder="Type to search teachers…"
                autoComplete="off"
                className={cn(error && inputErrorClass)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setTeacherId(null);
                  setOpen(true);
                  setError("");
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
              />
              {open ? (
                <div className="absolute inset-x-0 top-full z-20 mt-[0.3rem] max-h-[220px] overflow-y-auto rounded-md border border-border bg-card p-[0.3rem] shadow-[0_6px_18px_rgba(23,31,50,.09)]">
                  {filtered.length > 0 ? (
                    filtered.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onMouseDown={() => {
                          setTeacherId(t.id);
                          setSearch(t.name);
                          setOpen(false);
                          setError("");
                        }}
                        className="flex w-full flex-col items-start gap-[0.05rem] rounded-md px-[0.65rem] py-2 text-left hover:bg-background"
                      >
                        <span className="text-[0.85rem] font-semibold text-foreground">{t.name}</span>
                        <span className="text-[0.72rem] text-muted-foreground">
                          {t.email}
                          {shortLabel(t.programme) ? ` · ${shortLabel(t.programme)}` : ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-[0.65rem] py-[0.6rem] text-[0.8rem] text-muted-foreground">No teachers match &quot;{search}&quot;</p>
                  )}
                </div>
              ) : null}
            </>
          )}
          <FieldError>{error}</FieldError>
        </FormGroup>
        <ModalActions>
          <ClassicButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </ClassicButton>
          <ClassicButton type="submit" disabled={teachers.length === 0 || saving}>
            {saving ? "Assigning…" : "Assign"}
          </ClassicButton>
        </ModalActions>
      </form>
    </ClassicModal>
  );
}
