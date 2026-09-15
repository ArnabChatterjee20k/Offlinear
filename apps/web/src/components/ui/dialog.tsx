import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export const DialogTitle = D.Title;
export const DialogDescription = D.Description;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof D.Overlay>,
  React.ComponentPropsWithoutRef<typeof D.Overlay>
>(({ className, ...props }, ref) => (
  <D.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]", className)}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

/** Centered dialog (used by the command palette). */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof D.Content>,
  React.ComponentPropsWithoutRef<typeof D.Content>
>(({ className, children, ...props }, ref) => (
  <D.Portal>
    <DialogOverlay />
    <D.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-[18%] z-50 w-full max-w-[560px] -translate-x-1/2 rounded-xl border border-hairline-strong bg-surface-2 shadow-2xl",
        className
      )}
      {...props}
    >
      {children}
    </D.Content>
  </D.Portal>
));
DialogContent.displayName = "DialogContent";

/** Right-side slide-over sheet (used by the issue panel). */
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof D.Content>,
  React.ComponentPropsWithoutRef<typeof D.Content>
>(({ className, children, ...props }, ref) => (
  <D.Portal>
    <DialogOverlay />
    <D.Content
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 h-full w-full max-w-[720px] border-l border-hairline bg-canvas shadow-2xl outline-none",
        "flex flex-col",
        className
      )}
      {...props}
    >
      {children}
    </D.Content>
  </D.Portal>
));
SheetContent.displayName = "SheetContent";
