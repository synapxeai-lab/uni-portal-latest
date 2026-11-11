import * as React from "react";

interface SearchDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SearchDialogContext = React.createContext<SearchDialogContextValue | null>(null);

/**
 * Owns the global search dialog's open state and the Ctrl/Cmd+K shortcut
 * that toggles it - mounted once in Shell so the shortcut works from
 * anywhere in the authenticated app, not just while the header search bar
 * happens to be focused.
 */
export function SearchDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) {
        return;
      }

      event.preventDefault();
      setOpen((previous) => !previous);
    }

    // Cmd/Ctrl+K is a deliberate global override (matches every app that
    // supports it) - it fires even while focus is inside another input.
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = React.useMemo(() => ({ open, setOpen }), [open]);

  return <SearchDialogContext.Provider value={value}>{children}</SearchDialogContext.Provider>;
}

export function useSearchDialog() {
  const context = React.useContext(SearchDialogContext);

  if (!context) {
    throw new Error("useSearchDialog must be used within a SearchDialogProvider");
  }

  return context;
}
