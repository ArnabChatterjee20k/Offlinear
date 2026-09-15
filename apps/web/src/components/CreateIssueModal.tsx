import * as React from "react";
import { PRIORITY_LABELS, type Priority } from "@offlinear/shared";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";
import { Avatar } from "./ui/primitives";
import { PriorityIcon, StateIcon } from "./icons";
import { useLookups } from "@/hooks/useData";
import { useUI } from "@/store/ui";
import { createIssue } from "@/store/mutations";
import { deleteDraft, getDraft, saveDraft, type DraftInput } from "@/store/drafts";
import { getActorId } from "@/store/session";

const PRIORITIES: Priority[] = [1, 2, 3, 4, 0];

const Trigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, ...props }, ref) => (
  <button
    ref={ref}
    className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2 py-1 text-[12px] text-ink-muted hover:border-hairline-strong hover:text-ink"
    {...props}
  >
    {children}
  </button>
));
Trigger.displayName = "Trigger";

export function CreateIssueModal() {
  const create = useUI((s) => s.create);
  const closeCreate = useUI((s) => s.closeCreate);
  const { states, members, stateById, memberById } = useLookups();

  const defaultState = React.useMemo(
    () => states.find((s) => s.type === "unstarted")?.id ?? states[0]?.id ?? null,
    [states]
  );

  const [form, setForm] = React.useState<DraftInput>({
    title: "",
    description: "",
    stateId: null,
    priority: 0,
    assigneeId: null,
    labelIds: [],
  });

  // Initialise ONCE when the modal opens (never on later state loads, or it
  // would wipe what the user is typing).
  React.useEffect(() => {
    if (!create?.open) return;
    let cancelled = false;
    (async () => {
      if (create.draftId) {
        const d = await getDraft(create.draftId);
        if (d && !cancelled)
          setForm({
            title: d.title,
            description: d.description,
            stateId: d.stateId,
            priority: d.priority,
            assigneeId: d.assigneeId,
            labelIds: d.labelIds,
          });
      } else if (!cancelled) {
        setForm({
          title: "",
          description: "",
          stateId: create.stateId ?? null,
          priority: 0,
          assigneeId: getActorId(),
          labelIds: [],
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create?.open, create?.draftId]);

  // Fill a default status once states are available, without touching other fields.
  React.useEffect(() => {
    if (create?.open && defaultState) {
      setForm((f) => (f.stateId == null ? { ...f, stateId: defaultState } : f));
    }
  }, [create?.open, defaultState]);

  const set = (patch: Partial<DraftInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.title.trim()) return;
    await createIssue({
      title: form.title.trim(),
      description: form.description,
      stateId: form.stateId ?? undefined,
      priority: form.priority,
      assigneeId: form.assigneeId,
      labelIds: form.labelIds,
    });
    if (create?.draftId) await deleteDraft(create.draftId);
    closeCreate();
  };

  // Dismissing (Esc / backdrop): keep as a draft if there's a title, else drop.
  const dismiss = async () => {
    if (form.title.trim()) await saveDraft(form, create?.draftId);
    else if (create?.draftId) await deleteDraft(create.draftId);
    closeCreate();
  };

  const state = form.stateId ? stateById.get(form.stateId) : undefined;
  const assignee = form.assigneeId ? memberById.get(form.assigneeId) : undefined;

  return (
    <Dialog open={!!create?.open} onOpenChange={(o) => !o && void dismiss()}>
      <DialogContent aria-describedby={undefined} className="max-w-[600px] p-0">
        <DialogTitle className="sr-only">Create issue</DialogTitle>
        <div className="px-5 pt-4">
          <input
            autoFocus
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            placeholder="Issue title"
            className="w-full bg-transparent text-[17px] font-medium text-ink outline-none placeholder:text-ink-tertiary"
          />
          <Textarea
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={5}
            placeholder="Add description… (Markdown supported)"
            className="mt-2 border-0 bg-transparent px-0 focus-visible:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Trigger>
                <StateIcon state={state} /> {state?.name ?? "Status"}
              </Trigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {states.map((s) => (
                <DropdownMenuItem key={s.id} selected={s.id === form.stateId} onSelect={() => set({ stateId: s.id })}>
                  <StateIcon state={s} /> {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Trigger>
                <PriorityIcon priority={form.priority} /> {PRIORITY_LABELS[form.priority]}
              </Trigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PRIORITIES.map((p) => (
                <DropdownMenuItem key={p} selected={p === form.priority} onSelect={() => set({ priority: p })}>
                  <PriorityIcon priority={p} /> {PRIORITY_LABELS[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Trigger>
                {assignee ? (
                  <>
                    <Avatar name={assignee.name} size={16} /> {assignee.name}
                  </>
                ) : (
                  <span className="text-ink-tertiary">Assignee</span>
                )}
              </Trigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem selected={form.assigneeId == null} onSelect={() => set({ assigneeId: null })}>
                Unassigned
              </DropdownMenuItem>
              {members
                .filter((m) => !m.isAgent)
                .map((m) => (
                  <DropdownMenuItem key={m.id} selected={m.id === form.assigneeId} onSelect={() => set({ assigneeId: m.id })}>
                    <Avatar name={m.name} size={16} /> {m.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between border-t border-hairline px-5 py-3">
          <span className="text-[11px] text-ink-tertiary">⌘↵ to create · Esc saves a draft</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void dismiss()}>
              Save draft
            </Button>
            <Button variant="primary" size="sm" disabled={!form.title.trim()} onClick={() => void submit()}>
              Create issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
