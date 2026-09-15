import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DM.Content>,
  React.ComponentPropsWithoutRef<typeof DM.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DM.Portal>
    <DM.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[190px] overflow-hidden rounded-lg border border-hairline-strong bg-surface-3 p-1 shadow-2xl",
        className
      )}
      {...props}
    />
  </DM.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DM.Item>,
  React.ComponentPropsWithoutRef<typeof DM.Item> & { selected?: boolean }
>(({ className, selected, children, ...props }, ref) => (
  <DM.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink-muted outline-none",
      "focus:bg-surface-4 focus:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    {selected != null && (
      <Check className={cn("ml-auto h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
    )}
  </DM.Item>
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuLabel = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("px-2 py-1.5 text-[11px] uppercase tracking-wider text-ink-tertiary", className)} {...props} />
);

export const DropdownMenuSeparator = () => <DM.Separator className="my-1 h-px bg-hairline" />;
