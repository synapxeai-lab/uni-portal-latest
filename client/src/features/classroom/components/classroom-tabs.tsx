import Link from "@/components/ui/link";
import { usePathname } from "@/lib/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { label: "Stream", segment: "stream" },
  { label: "Classwork", segment: "classwork" },
  { label: "People", segment: "people" },
] as const;

// A course classroom's attendance and marks live on the sidebar's Attendance and Marks pages.
export function ClassroomTabs({ classroomId }: { classroomId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Classroom" className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const href = `/classes/${classroomId}/${tab.segment}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "border-primary font-semibold text-primary dark:border-foreground dark:text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
