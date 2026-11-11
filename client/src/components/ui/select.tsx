import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border-[1.5px] border-input bg-card px-[0.9rem] py-2 text-[0.94rem] text-foreground transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/12 disabled:cursor-not-allowed disabled:opacity-60 max-md:text-base",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";

export { Select };
