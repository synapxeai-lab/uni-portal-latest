import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        // 40px 52px on desktop, 1rem on tablets/phones, 0.75rem on small phones;
        // every page body fades in.
        "mx-auto flex w-full animate-fade-in flex-col gap-6 p-3 min-[481px]:p-4 md:px-[52px] md:py-[40px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
