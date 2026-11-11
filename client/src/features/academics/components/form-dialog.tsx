import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@portal/shared/action-result";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type FieldValue = string | number | boolean | number[] | null;

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "textarea" | "select" | "checkboxes" | "password";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Number fields: send null instead of 0 when left empty. */
  nullable?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** Takes the full row on wide dialogs (two-column layout). */
  wide?: boolean;
  /** Hide the field depending on the other values. */
  hidden?: (values: Record<string, FieldValue>) => boolean;
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  /** Any record whose keys match field names (e.g. the row being edited). */
  initialValues?: object;
  submitLabel?: string;
  /** Two columns on wide screens (long forms like teacher/student records). */
  wide?: boolean;
  onSubmit: (values: Record<string, FieldValue>) => Promise<ActionResult<{ message?: string } | unknown>>;
  /** Called with the success data; the dialog closes itself. */
  onSaved?: (data: unknown) => void;
  children?: ReactNode;
}

function emptyValue(field: FormField): FieldValue {
  if (field.type === "checkboxes") {
    return [];
  }
  if (field.type === "number") {
    return field.nullable ? null : "";
  }
  return "";
}

/**
 * A dialog form driven by a field list - the academic pages' add/edit
 * dialogs (programmes, diplomas, courses, batches, teachers, students...).
 * Number fields are sent as numbers, dates as yyyy-mm-dd strings; field
 * errors from the API show under their inputs.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialValues,
  submitLabel = "Save",
  wide = false,
  onSubmit,
  onSaved,
  children,
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<Partial<Record<string, string[]>>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(
        Object.fromEntries(
          fields.map((field) => [
            field.name,
            ((initialValues as Record<string, FieldValue | undefined> | undefined)?.[field.name] ?? emptyValue(field)),
          ]),
        ),
      );
      setErrors({});
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (name: string, value: FieldValue) => setValues((current) => ({ ...current, [name]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, FieldValue> = {};
    for (const field of fields) {
      if (field.hidden?.(values)) {
        continue;
      }
      const value = values[field.name];
      if (field.type === "number") {
        payload[field.name] = value === "" || value === null ? (field.nullable ? null : undefined!) : Number(value);
        if (payload[field.name] === undefined) {
          delete payload[field.name];
        }
      } else if (field.type === "select" && field.options?.every((o) => typeof o.value === "number")) {
        payload[field.name] = value === "" || value === null ? null : Number(value);
      } else {
        payload[field.name] = value;
      }
    }
    setPending(true);
    const result = await onSubmit(payload);
    setPending(false);
    if (result.status === "success") {
      const message = (result.data as { message?: string } | undefined)?.message;
      if (message) {
        toast.success(message);
      }
      onOpenChange(false);
      onSaved?.(result.data);
    } else {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className={cn("grid gap-4 py-4", wide && "sm:grid-cols-2")}>
            {fields
              .filter((field) => !field.hidden?.(values))
              .map((field) => {
                const id = `field-${field.name}`;
                const error = errors[field.name]?.[0];
                const value = values[field.name];
                const common = {
                  id,
                  name: field.name,
                  required: field.required,
                  "aria-invalid": error ? true : undefined,
                };
                let control: ReactNode;
                if (field.type === "textarea") {
                  control = (
                    <Textarea
                      {...common}
                      rows={3}
                      value={String(value ?? "")}
                      placeholder={field.placeholder}
                      onChange={(e) => set(field.name, e.target.value)}
                    />
                  );
                } else if (field.type === "select") {
                  control = (
                    <Select {...common} value={String(value ?? "")} onChange={(e) => set(field.name, e.target.value)}>
                      <option value="">{field.placeholder ?? `Select ${field.label.toLowerCase()}`}</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  );
                } else if (field.type === "checkboxes") {
                  const selected = Array.isArray(value) ? value : [];
                  control = (
                    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
                      {field.options?.map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--navy)]"
                            checked={selected.includes(Number(option.value))}
                            onChange={(e) =>
                              set(
                                field.name,
                                e.target.checked
                                  ? [...selected, Number(option.value)]
                                  : selected.filter((v) => v !== Number(option.value)),
                              )
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  );
                } else {
                  control = (
                    <Input
                      {...common}
                      type={field.type ?? "text"}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={value === null || value === undefined ? "" : String(value)}
                      placeholder={field.placeholder}
                      onChange={(e) => set(field.name, e.target.value)}
                    />
                  );
                }
                return (
                  <div
                    key={field.name}
                    className={cn("flex flex-col gap-1.5", (field.wide || field.type === "textarea") && "sm:col-span-2")}
                  >
                    <Label htmlFor={id}>
                      {field.label}
                      {field.required ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    {control}
                    {error ? (
                      <p className="text-xs text-destructive">{error}</p>
                    ) : field.hint ? (
                      <p className="text-xs text-muted-foreground">{field.hint}</p>
                    ) : null}
                  </div>
                );
              })}
            {children}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
