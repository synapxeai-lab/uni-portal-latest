import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-[0.9rem] py-2 text-[0.94rem] text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-faint-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/12 disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-muted max-md:text-base",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
