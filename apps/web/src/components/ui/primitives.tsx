import * as React from "react";
import { cn } from "@/lib/utils";

/** Colored initials avatar for a member (or a fallback dot). */
export function Avatar({
  name,
  size = 20,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = (name ?? "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const hue = hashHue(name ?? "?");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `hsl(${hue} 45% 45%)`,
      }}
    >
      {initials || "?"}
    </span>
  );
}

export function Badge({
  children,
  className,
  color,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-hairline bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted",
        className
      )}
      style={color ? { borderColor: `${color}55`, color } : undefined}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-hairline bg-surface-3 px-1 font-mono text-[10px] text-ink-subtle">
      {children}
    </kbd>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
