import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useLiveQuery } from "dexie-react-hooks";
import { Hash, AtSign, FileText, Paperclip } from "lucide-react";
import { db } from "@/db/db";
import { useReports } from "@/hooks/useData";
import { Input } from "./ui/input";

/** Button + hidden file input to upload attachments (external upload). */
export function AttachButton({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink"
        title="Upload a file or image"
      >
        <Paperclip className="h-3.5 w-3.5" /> Attach
      </button>
    </>
  );
}

/** Popover to pick an issue and insert a cross-link. */
export function IssuePicker({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const results =
    useLiveQuery(async () => {
      const term = q.trim().toLowerCase();
      const all = await db.issues.limit(2000).toArray();
      return all
        .filter((i) => !term || i.key.toLowerCase().includes(term) || i.title.toLowerCase().includes(term))
        .slice(0, 8);
    }, [q]) ?? [];
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink">
          <Hash className="h-3.5 w-3.5" /> Link issue
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[340px] rounded-lg border border-hairline-strong bg-surface-3 p-1.5 shadow-2xl">
          <Input autoFocus placeholder="Search issues…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-1 bg-surface-2" />
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
                <span className="font-mono text-[11px] text-ink-tertiary">{i.key}</span>
                <span className="truncate text-[13px] text-ink-muted">{i.title}</span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Popover to pick another report and insert a cross-link. */
export function ReportPicker({
  excludeId,
  onPick,
}: {
  excludeId?: string;
  onPick: (id: string, name: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const reports = useReports();
  const list = reports.filter((r) => r.id !== excludeId);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink">
          <AtSign className="h-3.5 w-3.5" /> Link report
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[300px] rounded-lg border border-hairline-strong bg-surface-3 p-1.5 shadow-2xl">
          <div className="max-h-[260px] overflow-y-auto">
            {list.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onPick(r.id, r.title);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-4"
              >
                <FileText className="h-3.5 w-3.5 text-ink-tertiary" />
                <span className="truncate text-[13px] text-ink-muted">{r.title}</span>
              </button>
            ))}
            {list.length === 0 && (
              <div className="px-2 py-3 text-center text-[13px] text-ink-tertiary">No other reports</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
