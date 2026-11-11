import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { useSearchDialog } from "@/features/search/context/search-dialog-context";
import { cn } from "@/lib/utils";

export function SearchBar({ className }: { className?: string }) {
  const { setOpen } = useSearchDialog();
  // Avoids rendering a platform-specific shortcut hint ("⌘K" vs "Ctrl K")
  // until after hydration, so the server-rendered markup doesn't depend on
  // navigator.platform (unavailable during SSR) and can't mismatch.
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.platform ?? window.navigator.userAgent));
  }, []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "flex h-[38px] w-full max-w-md items-center gap-2 rounded-md border border-border bg-background px-3 text-left text-[0.875rem] text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:bg-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-ring",
        className,
      )}
      aria-label="Search classes, people, and files"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">Search classes, people, and files</span>
      <kbd className="hidden shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
