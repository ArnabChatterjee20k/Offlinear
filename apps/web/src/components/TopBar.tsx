import { Command, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Kbd } from "./ui/primitives";
import { useSync } from "@/sync/engine";
import { useUI } from "@/store/ui";
import { createIssue } from "@/store/mutations";

function SyncDot() {
  const { online, pending, syncing } = useSync();
  const state = !online ? "offline" : syncing || pending > 0 ? "syncing" : "synced";
  const color =
    state === "offline" ? "bg-ink-tertiary" : state === "syncing" ? "bg-brand" : "bg-success";
  const label =
    state === "offline"
      ? "Offline — changes queued"
      : pending > 0
        ? `Syncing ${pending}…`
        : "All changes saved";
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-ink-subtle">
      <span className={cn("h-2 w-2 rounded-full", color, state === "syncing" && "animate-pulse")} />
      {label}
    </div>
  );
}

export function TopBar() {
  const openPalette = useUI((s) => s.openPalette);
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline px-5">
      <h2 className="text-[14px] font-medium text-ink">Board</h2>
      <SyncDot />
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => openPalette()}
          className="flex items-center gap-2 rounded-md border border-hairline bg-surface-1 px-2.5 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong"
        >
          <Command className="h-3.5 w-3.5" />
          Search…
          <Kbd>⌘K</Kbd>
        </button>
        <Button variant="primary" size="sm" onClick={() => createIssue({ title: "New issue" })}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>
    </header>
  );
}
