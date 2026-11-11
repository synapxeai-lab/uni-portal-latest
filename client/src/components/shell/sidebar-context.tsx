import * as React from "react";

const COLLAPSED_STORAGE_KEY = "sidebarCollapsed";

interface SidebarContextValue {
  isCollapsed: boolean;
  /** False when the sidebar is pinned expanded (admin shell) - hides the collapse button. */
  canCollapse: boolean;
  toggleCollapsed: () => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

interface SidebarProviderProps {
  children: React.ReactNode;
  /**
   * Pins the desktop sidebar permanently expanded and makes toggleCollapsed
   * a no-op - used by AdminShell so the mini/collapsed sidebar behavior is
   * disabled throughout the admin experience, without touching the default
   * (teacher/student) Shell, which mounts its own separate SidebarProvider
   * instance and is unaffected by this prop.
   */
  forceExpanded?: boolean;
}

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function SidebarProvider({ children, forceExpanded = false }: SidebarProviderProps) {
  const [isCollapsedState, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  // The collapsed state is remembered per browser. Read after mount so the
  // server render (always expanded) and the first client render match.
  React.useEffect(() => {
    if (!forceExpanded && readStoredCollapsed()) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setIsCollapsed(true);
    }
  }, [forceExpanded]);

  const value = React.useMemo(
    () => ({
      isCollapsed: forceExpanded ? false : isCollapsedState,
      canCollapse: !forceExpanded,
      toggleCollapsed: () => {
        if (forceExpanded) {
          return;
        }
        setIsCollapsed((previous) => {
          const next = !previous;
          try {
            window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
          } catch {
            // Storage unavailable (private mode) - the toggle still works for this visit.
          }
          return next;
        });
      },
      isMobileOpen,
      setMobileOpen: setIsMobileOpen,
    }),
    [forceExpanded, isCollapsedState, isMobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }

  return context;
}
