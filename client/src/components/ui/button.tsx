import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[0.45rem] whitespace-nowrap rounded-md text-[0.875rem] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Gold call to action - aim for one per view; secondary actions use outline.
        // Disabled: neutral border-coloured fill with muted text, not a faded gold.
        default:
          "bg-cta text-[0.95rem] font-bold tracking-[0.01em] text-cta-foreground hover:bg-cta-hover disabled:bg-border disabled:text-muted-foreground disabled:opacity-100",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        outline:
          "border border-border-strong bg-card text-mid-foreground hover:border-gold hover:bg-accent hover:text-accent-foreground",
        ghost: "text-mid-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive font-bold text-destructive-foreground hover:bg-destructive-hover",
        link: "rounded-full text-link hover:bg-sidebar hover:text-sidebar-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-[0.8rem]",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
