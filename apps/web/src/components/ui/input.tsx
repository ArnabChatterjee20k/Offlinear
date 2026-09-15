import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-8 w-full rounded-md bg-surface-1 border border-hairline px-3 text-[14px] text-ink placeholder:text-ink-tertiary",
      "focus-visible:focus-ring focus-visible:border-hairline-strong",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-md bg-surface-1 border border-hairline px-3 py-2 text-[14px] text-ink placeholder:text-ink-tertiary resize-none",
      "focus-visible:focus-ring focus-visible:border-hairline-strong",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
