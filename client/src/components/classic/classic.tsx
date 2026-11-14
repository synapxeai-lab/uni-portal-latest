/**
 * "Classic" UI kit: exact replicas of the old University Portal's components
 * (apps/frontend/src/index.css + components/*.jsx), on the unified design
 * tokens so they also work in dark mode. Used by pages rebuilt to match the
 * old portal's look.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, LayoutGrid, List, Menu as MenuIcon, Search, X } from "lucide-react";

import { useGoBack } from "@/components/page/back-button";
import Link from "@/components/ui/link";

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
  centered,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  width?: number;
  /** .modal-box-centered: a tall form centred in the viewport, scrolling inside its body. */
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[9000] flex justify-center overflow-x-hidden overscroll-contain bg-black/[.52] px-4 backdrop-blur-[3px]",
            centered ? "items-center overflow-hidden pb-[calc(1.5rem+8vh)] pt-6" : "items-start overflow-y-auto py-12",
          )}
        >
          <DialogPrimitive.Content
            aria-describedby={undefined}
            style={{ maxWidth: width }}
            className={cn(
              "w-full shrink-0 animate-dialog-in rounded-2xl bg-card p-7 shadow-[0_20px_48px_rgba(23,31,50,0.18)] outline-none max-[640px]:p-5",
              centered && "flex max-h-[calc(100dvh-3rem-8vh)] flex-col",
            )}
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
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  confirmVariant?: "danger" | "primary";
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
        <ClassicButton variant={confirmVariant} onClick={onConfirm} disabled={pending}>
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
export function TableEmpty({ icon: Icon, children }: { icon?: typeof X; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-[0.6rem] px-4 py-14 text-center text-sm text-muted-foreground">
      {Icon ? <Icon className="size-8 text-border-strong" aria-hidden /> : null}
      <p>{children}</p>
    </div>
  );
}

// ---- Filters ---------------------------------------------------------------------------

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

/** A labelled row of pills for picking one filter value: "PROGRAMME: (All 12) (Tourism 5) …". */
export function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-mid-foreground">{label}:</span>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-[0.4rem] whitespace-nowrap rounded-full border px-[0.95rem] py-[0.35rem] text-[0.8rem] transition-colors",
              active
                ? "border-gold bg-gold-soft font-semibold text-primary"
                : "border-border bg-card font-medium text-foreground hover:border-border-strong hover:bg-background",
            )}
          >
            {o.label}
            {o.count != null ? (
              <span
                className={cn(
                  "rounded-full px-[0.4rem] text-[0.7rem] font-semibold",
                  active ? "bg-card text-primary" : "bg-background text-muted-foreground",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Several pill groups on one row (.filter-pills-row). */
export function FilterPillsRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-8 gap-y-2">{children}</div>;
}

/** The old search box: 38px, icon on the left, clear button on the right. */
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-[38px] w-full rounded-md border border-border bg-card px-9 text-sm text-foreground outline-none transition-colors placeholder:text-faint-foreground focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-ring)] max-md:text-base"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear"
          className="absolute right-[0.6rem] top-1/2 flex -translate-y-1/2 text-muted-foreground"
        >
          <X className="size-[14px]" />
        </button>
      ) : null}
    </div>
  );
}

// ---- Row action buttons ----------------------------------------------------------------

/** .btn-edit (gold tint) / .btn-del (red tint); the label hides on small phones. */
export function RowButton({
  kind,
  icon: Icon,
  label,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & { kind: "edit" | "delete"; icon: typeof X; label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-[0.3rem] whitespace-nowrap rounded-md border px-[0.65rem] py-[0.3rem] text-[0.78rem] font-semibold transition-all",
        kind === "edit"
          ? "border-gold-border bg-gold-soft text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
          : "border-destructive-border bg-destructive-soft text-destructive hover:enabled:border-destructive hover:enabled:bg-destructive hover:enabled:text-white disabled:opacity-40",
        "disabled:cursor-not-allowed",
      )}
      {...props}
    >
      <Icon className="size-[13px]" aria-hidden /> <span className="max-[480px]:hidden">{label}</span>
    </button>
  );
}

// ---- Detail pages ----------------------------------------------------------------------

/** .back-link: "← Back to …", one step back (or `fallback` when there's no earlier page). */
export function BackLink({ fallback, children }: { fallback: string; children: ReactNode }) {
  const goBack = useGoBack(fallback);
  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-[0.55rem] inline-flex w-fit max-w-full items-center gap-[0.4rem] rounded-md px-[0.55rem] py-[0.3rem] text-left text-[0.83rem] font-semibold text-mid-foreground transition-colors hover:bg-gold-soft hover:text-primary"
    >
      <ArrowLeft className="size-[15px] shrink-0" aria-hidden /> {children}
    </button>
  );
}

/** .nav-btn: an in-text link with a gold-tint pill on hover. */
export function NavLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "-mx-[0.45rem] -my-[0.15rem] inline-flex items-center gap-[0.3rem] rounded-md px-[0.45rem] py-[0.15rem] transition-colors hover:bg-gold-soft hover:text-primary",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** .details-section: bordered box with a small navy uppercase heading and a two-column <dl>. */
export function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-card px-4 py-[0.9rem] shadow-[0_1px_2px_rgba(23,31,50,.05)]">
      <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.05em] text-primary">{title}</h3>
      <dl className="m-0 grid grid-cols-2 gap-x-[1.2rem] gap-y-[0.8rem]">{children}</dl>
    </section>
  );
}

export function DetailsField({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn(wide && "col-span-full")}>
      <dt className="mb-[0.15rem] text-[0.72rem] text-muted-foreground">{label}</dt>
      <dd className="m-0 text-[0.86rem] font-medium text-foreground [overflow-wrap:anywhere]">{empty ? "—" : value}</dd>
    </div>
  );
}

/** .semester-heading: a small bold heading over a block, with optional muted meta. */
export function BlockHeading({ meta, className, children }: { meta?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <h3 className={cn("mb-[0.65rem] pl-[0.1rem] text-[0.85rem] font-bold text-foreground", className)}>
      {children}
      {meta ? <span className="font-medium text-muted-foreground">{meta}</span> : null}
    </h3>
  );
}

/**
 * .dept-detail-header: a card with a coloured left edge and a tile (code or
 * initials) in the item's colours, then title, subtitle and a meta row.
 */
export function DetailHeader({
  tile,
  color,
  bg,
  title,
  subtitle,
  meta,
  action,
}: {
  tile: ReactNode;
  color?: string;
  bg?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="mb-6 flex gap-[1.1rem] rounded-[10px] border border-l-4 border-border bg-card p-[1.35rem] shadow-[0_1px_2px_rgba(23,31,50,.05)] max-[480px]:flex-col max-[480px]:p-[1.1rem]"
      style={{ borderLeftColor: bg }}
    >
      <div
        className="flex h-[52px] min-w-[52px] shrink-0 items-center justify-center self-start whitespace-nowrap rounded-md px-[0.6rem] text-[0.9rem] font-extrabold"
        style={{ background: bg, color }}
      >
        {tile}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="mb-[0.35rem] font-heading text-[1.25rem] font-extrabold text-foreground">{title}</h1>
        {subtitle ? <p className="mb-[0.6rem] text-[0.8rem] text-muted-foreground">{subtitle}</p> : null}
        {meta ? (
          <div className="flex flex-wrap items-center gap-5 text-[0.78rem] text-muted-foreground [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[0.35rem] [&_svg]:size-[13px]">
            {meta}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
}

/** .page-header: title + muted subtitle on the left, the main action on the right. */
export function ClassicPageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="mb-[0.2rem] font-heading text-[1.25rem] font-extrabold text-foreground">{title}</h1>
        {subtitle ? <p className="text-[0.8rem] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
