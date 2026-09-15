import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { Input } from "./ui/input";
import { StateIcon } from "./icons";
import { useLookups } from "@/hooks/useData";

/** Popover issue picker (the `#`-search for relations and re-parenting). */
export function IssueSearch({
  trigger,
  excludeId,
  onPick,
}: {
  trigger: React.ReactNode;
  excludeId?: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const { stateById } = useLookups();

  const results = useLiveQuery(async () => {
    const term = q.trim().toLowerCase();
    const all = await db.issues.limit(2000).toArray();
    return all
      .filter((i) => i.id !== excludeId)
      .filter(
        (i) =>
          !term ||
          i.key.toLowerCase().includes(term) ||
          i.title.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [q, excludeId]) ?? [];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[340px] rounded-lg border border-hairline-strong bg-surface-3 p-1.5 shadow-2xl"
        >
          <Input
            autoFocus
            placeholder="Search issues by key or title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-1 bg-surface-2"
          />
          <div className="max-h-[260px] overflow-y-auto">
            {results.map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  onPick(i.id);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-4"
              >
                <StateIcon state={stateById.get(i.stateId)} />
                <span className="font-mono text-[11px] text-ink-tertiary">{i.key}</span>
                <span className="truncate text-[13px] text-ink-muted">{i.title}</span>
              </button>
            ))}
            {results.length === 0 && (
              <div className="px-2 py-3 text-center text-[13px] text-ink-tertiary">No matches</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
