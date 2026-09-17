import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Bell, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useNotifications } from "@/store/notifications";
import { resolveKeepRemote, resolveWithMerge } from "@/github/gists";
import { relTime } from "@/lib/time";

/** Bell button + dropdown. Safe to render in multiple headers (shared store). */
export function NotificationBell() {
  const items = useNotifications((s) => s.items);
  const dismiss = useNotifications((s) => s.dismiss);
  const setResolving = useNotifications((s) => s.setResolving);
  const [open, setOpen] = React.useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="relative rounded-md p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {items.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
              {items.length}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[340px] rounded-lg border border-hairline-strong bg-surface-3 p-1.5 shadow-2xl"
        >
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-ink-tertiary">
            Notifications
          </div>
          {items.length === 0 && (
            <div className="px-2 py-6 text-center text-[13px] text-ink-tertiary">All clear.</div>
          )}
          <div className="max-h-[320px] space-y-1 overflow-y-auto">
            {items.map((n) => (
              <div key={n.id} className="rounded-md border border-hairline bg-surface-2 p-2.5">
                <div className="flex items-start gap-2">
                  {n.kind === "gist-conflict" ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f2c94c]" />
                  ) : (
                    <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink">{n.title}</div>
                    <div className="text-[12px] text-ink-subtle">{n.message}</div>
                    <div className="mt-0.5 text-[11px] text-ink-tertiary">{relTime(n.createdAt)}</div>
                    {n.conflict && (
                      <button
                        onClick={() => {
                          setResolving(n.conflict!.reportId);
                          setOpen(false);
                        }}
                        className="mt-1.5 rounded-md bg-brand px-2 py-1 text-[12px] font-medium text-white hover:bg-brand-hover"
                      >
                        Resolve conflict
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    className="rounded p-0.5 text-ink-tertiary hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Single mount (in App): the gist merge-conflict resolver. */
export function MergeModal() {
  const resolving = useNotifications((s) => s.resolving);
  const items = useNotifications((s) => s.items);
  const setResolving = useNotifications((s) => s.setResolving);
  const dismissConflict = useNotifications((s) => s.dismissConflict);

  const conflict = items.find((n) => n.conflict?.reportId === resolving)?.conflict ?? null;
  const [merged, setMerged] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (conflict) setMerged(conflict.localBody);
  }, [conflict?.reportId]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => setResolving(null);
  const run = async (fn: () => Promise<void>) => {
    if (!conflict) return;
    setBusy(true);
    try {
      await fn();
      dismissConflict(conflict.reportId);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!conflict} onOpenChange={(o) => !o && close()}>
      {conflict && (
        <DialogContent aria-describedby={undefined} className="max-w-[860px] p-0">
          <div className="border-b border-hairline px-5 py-3.5">
            <DialogTitle className="text-[15px] font-medium text-ink">Resolve gist conflict</DialogTitle>
            <p className="mt-0.5 text-[12px] text-ink-subtle">
              The gist changed on GitHub since your last sync. Pick a side, or merge.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <ConflictPane title="Yours (local)" body={conflict.localBody} />
            <ConflictPane title="GitHub (remote)" body={conflict.remoteBody} />
          </div>
          <div className="px-5">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-tertiary">Merged result</div>
            <textarea
              value={merged}
              onChange={(e) => setMerged(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-md border border-hairline bg-surface-1 p-3 font-mono text-[12px] text-ink outline-none focus-visible:focus-ring"
            />
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-4">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => resolveKeepRemote(conflict.reportId))}>
              Keep GitHub's
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => resolveWithMerge(conflict.reportId, conflict.localBody))}>
              Keep mine
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => run(() => resolveWithMerge(conflict.reportId, merged))}>
              Save merged → push
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

function ConflictPane({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-tertiary">{title}</div>
      <pre
        className={cn(
          "max-h-[220px] overflow-auto rounded-md border border-hairline bg-surface-1 p-3 font-mono text-[12px] text-ink-muted whitespace-pre-wrap"
        )}
      >
        {body || "(empty)"}
      </pre>
    </div>
  );
}
