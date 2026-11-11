import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // 1.5px warm-grey border; focus = navy border + 3px gold glow. 16px on
          // phones so iOS doesn't zoom into the field.
          "flex h-10 w-full rounded-md border-[1.5px] border-input bg-card px-[0.9rem] py-2 text-[0.94rem] text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-faint-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/12 disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-muted max-md:text-base",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
