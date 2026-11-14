/**
 * "Classic" UI kit: exact replicas of the old University Portal's components
 * (apps/frontend/src/index.css + components/*.jsx), on the unified design
 * tokens so they also work in dark mode. Used by pages rebuilt to match the
 * old portal's look.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { LayoutGrid, List, Menu as MenuIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";

// ---- Cards / List toggle ---------------------------------------------------------------

export type ViewMode = "cards" | "list";

const listeners = new Set<() => void>();
const modes = new Map<string, ViewMode>();
const storageKey = (scope: string) => (scope === "global" ? "viewMode" : `viewMode:${scope}`);

function readMode(scope: string, fallback: ViewMode): ViewMode {
  try {
    const stored = localStorage.getItem(storageKey(scope));
    return stored === "list" || stored === "cards" ? stored : fallback;
  } catch {
    return fallback;
  }
}

function setMode(scope: string, next: ViewMode) {
  modes.set(scope, next);
  try {
    localStorage.setItem(storageKey(scope), next);
  } catch {
    // Storage unavailable: keep the choice for this visit.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The page's Cards / List choice, remembered across visits (per scope). */
export function useViewMode(scope = "global", fallback: ViewMode = "cards") {
  if (!modes.has(scope)) modes.set(scope, readMode(scope, fallback));
  const view = useSyncExternalStore(subscribe, () => modes.get(scope)!, () => fallback);
  return [view, (next: ViewMode) => setMode(scope, next)] as const;
}

const VIEWS = [
  { key: "cards" as const, label: "Cards", icon: LayoutGrid },
  { key: "list" as const, label: "List", icon: List },
];

export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div role="tablist" aria-label="Layout" className="inline-flex w-fit gap-1 rounded-[10px] border border-border bg-card p-1">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={view === v.key}
          onClick={() => onChange(v.key)}
          className={cn(
            "inline-flex items-center gap-[0.45rem] rounded-[7px] px-4 py-2 text-[0.85rem] font-semibold transition-colors",
            view === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground",
          )}
        >
          <v.icon className="size-[15px]" aria-hidden /> {v.label}
        </button>
      ))}
    </div>
  );
}

// ---- Pills -----------------------------------------------------------------------------

export type PillTone = "primary" | "success" | "muted" | "warning" | "error";

const PILL_TONES: Record<PillTone, string> = {
  primary: "border-gold-border bg-gold-soft text-primary",
  success: "border-[#bbf7d0] bg-[#dcfce7] text-[#166534] dark:border-success-border dark:bg-success-soft dark:text-success",
  muted: "border-border bg-muted text-muted-foreground",
  warning: "border-warning-border bg-warning-soft text-warning",
  error: "border-destructive-border bg-destructive-soft text-destructive",
};

export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 whitespace-nowrap rounded-[20px] border px-[0.6rem] py-[0.2rem] text-[0.68rem] font-bold tracking-[0.03em]",
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

// ---- Action menu (the ☰ button) ----------------------------------------------------------

export function ActionMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={label}
        title="Actions"
        className="inline-flex size-8 items-center justify-center rounded-md border border-border-strong bg-card text-mid-foreground transition-all data-[state=open]:border-gold data-[state=open]:bg-gold-soft data-[state=open]:text-primary"
      >
        <MenuIcon className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-[8000] min-w-[190px] rounded-md border border-border bg-card p-[0.3rem] shadow-[0_6px_18px_rgba(23,31,50,.09)]"
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function ActionMenuItem({ onSelect, danger, children }: { onSelect: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-[0.55rem] whitespace-nowrap rounded-md px-[0.65rem] py-2 text-left text-[0.8rem] font-semibold outline-none [&_svg]:size-3.5",
        danger
          ? "text-destructive data-[highlighted]:bg-destructive-soft"
          : "text-mid-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
      )}
    >
      {children}
    </Menu.Item>
  );
}

export const ActionMenuDivider = () => <Menu.Separator className="my-[0.3rem] h-px bg-border" />;

// ---- Modal -----------------------------------------------------------------------------

/**
 * The old .modal-overlay/.modal-box: top-aligned 3rem from the top, the
 * overlay scrolls (not the box), 500px wide (or `width`), radius 16.
 */
export function ClassicModal({
  open,
  onClose,
  title,
  width = 500,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9000] flex items-start justify-center overflow-y-auto overflow-x-hidden overscroll-contain bg-black/[.52] px-4 py-12 backdrop-blur-[3px]">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            style={{ maxWidth: width }}
            className="w-full shrink-0 animate-dialog-in rounded-2xl bg-card p-7 shadow-[0_20px_48px_rgba(23,31,50,0.18)] outline-none max-[640px]:p-5"
          >
            {title !== undefined ? (
              <div className="mb-6 flex items-center justify-between gap-3">
                <DialogPrimitive.Title className="font-heading text-[1.05rem] font-extrabold text-foreground">{title}</DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label="Close"
                  className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-destructive-border hover:bg-destructive-soft hover:text-destructive"
                >
                  <X className="size-[15px]" />
                </DialogPrimitive.Close>
              </div>
            ) : (
              <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
            )}
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Right-aligned Cancel → Confirm row (.modal-actions); buttons stretch on small phones. */
export function ModalActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-6 flex flex-wrap justify-end gap-3 max-[480px]:[&>*]:flex-1", className)}>{children}</div>;
}

/** The old ConfirmDialog: 400px, bold title, message, Cancel + red confirm. */
export function ClassicConfirm({
  open,
  title = "Confirm Action",
  message,
  confirmLabel = "Delete",
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ClassicModal open={open} onClose={onCancel} width={400}>
      <h3 className="mb-2 font-heading text-base font-bold text-foreground">{title}</h3>
      <p className="mb-6 text-sm leading-relaxed text-mid-foreground">{message}</p>
      <div className="flex justify-end gap-3">
        <ClassicButton variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </ClassicButton>
        <ClassicButton variant="danger" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </ClassicButton>
      </div>
    </ClassicModal>
  );
}

// ---- Buttons ---------------------------------------------------------------------------

const BUTTONS = {
  // .btn-primary
  primary:
    "bg-cta px-4 py-[0.72rem] text-[0.95rem] font-bold tracking-[0.01em] text-cta-foreground hover:bg-cta-hover disabled:bg-border disabled:text-muted-foreground",
  // .btn-outline
  outline:
    "border border-border-strong bg-card px-5 py-[0.6rem] text-sm font-semibold text-mid-foreground hover:border-gold hover:bg-gold-soft hover:text-primary disabled:opacity-60",
  // .btn-danger
  danger: "bg-destructive px-5 py-[0.6rem] text-sm font-bold text-white hover:bg-destructive-hover disabled:opacity-60",
};

export function ClassicButton({
  variant = "primary",
  size,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { variant?: keyof typeof BUTTONS; size?: "sm" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-[0.45rem] rounded-md transition-colors disabled:cursor-not-allowed [&_svg]:shrink-0",
        BUTTONS[variant],
        // The old `actionStyle`: compact buttons inside alerts.
        size === "sm" && "px-[0.8rem] py-[0.4rem] text-[0.78rem]",
        className,
      )}
      {...props}
    />
  );
}

// ---- Forms -----------------------------------------------------------------------------

export function FormGroup({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mb-[1.1rem]", className)}>{children}</div>;
}

/** Two columns that stack at ≤560px (.form-row). */
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 max-[560px]:grid-cols-1">{children}</div>;
}

export function FormLabel({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-[0.35rem] block text-[0.8rem] font-semibold tracking-[0.01em] text-mid-foreground">
      {children} {required ? <span className="text-destructive">*</span> : null}
    </label>
  );
}

export function FieldHint({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-[0.3rem] text-[0.72rem] text-muted-foreground", className)}>{children}</p>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  return children ? <p className="mt-[0.3rem] text-xs text-destructive">{children}</p> : null;
}

/** Field classes for an <Input>/<Select> in error (.input-error). */
export const inputErrorClass = "!border-destructive-border !bg-destructive-soft focus-visible:!ring-destructive/10";

export function Alert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-[1.1rem] flex flex-col items-start gap-[0.6rem] rounded-md border px-[0.9rem] py-[0.7rem] text-sm",
        tone === "error"
          ? "border-destructive-border bg-destructive-soft text-destructive"
          : "border-success-border bg-success-soft text-success",
      )}
    >
      {children}
    </div>
  );
}

// ---- Cards and tables ------------------------------------------------------------------

/** .sections-grid of .section-detail-card. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">{children}</div>;
}

export function DetailCard({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] border border-border bg-card p-[1.1rem] shadow-[0_1px_2px_rgba(23,31,50,.05)]">{children}</div>;
}

/** .table-empty: icon above muted text. */
export function TableEmpty({ icon: Icon, children }: { icon: typeof X; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-[0.6rem] px-4 py-14 text-center text-sm text-muted-foreground">
      <Icon className="size-8 text-border-strong" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
