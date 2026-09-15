import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors focus-visible:focus-ring disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-focus",
        secondary:
          "bg-surface-1 text-ink border border-hairline hover:bg-surface-2 hover:border-hairline-strong",
        ghost: "text-ink-subtle hover:text-ink hover:bg-surface-2",
        danger: "bg-transparent text-danger hover:bg-danger/10",
      },
      size: {
        sm: "h-7 px-2.5",
        md: "h-8 px-3.5",
        icon: "h-7 w-7 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
