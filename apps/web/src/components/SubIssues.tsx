import * as React from "react";
import { Plus, X } from "lucide-react";
import { StateIcon } from "./icons";
import { Input } from "./ui/input";
import { IssueSearch } from "./IssueSearch";
import { useLookups, useSubIssues } from "@/hooks/useData";
import { useUI } from "@/store/ui";
import { addSubIssue, setParent } from "@/store/mutations";

export function SubIssues({ parentId }: { parentId: string }) {
  const subs = useSubIssues(parentId);
  const { stateById } = useLookups();
  const openIssue = useUI((s) => s.openIssue);
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");

  const done = subs.filter((s) => stateById.get(s.stateId)?.type === "completed").length;

  const submit = () => {
    const t = title.trim();
    if (t) void addSubIssue(parentId, t);
    setTitle("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-ink-subtle">
          Sub-issues{" "}
          {subs.length > 0 && (
            <span className="text-ink-tertiary">
              · {done}/{subs.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          <IssueSearch
            excludeId={parentId}
            onPick={(id) => setParent(id, parentId)}
            trigger={
              <button
                className="rounded px-1.5 py-0.5 text-[11px] text-ink-tertiary hover:bg-surface-2 hover:text-ink"
                title="Link an existing issue as a sub-issue"
              >
                Link
              </button>
            }
          />
          <button
            className="rounded p-1 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
            title="Create a new sub-issue"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-hairline rounded-lg border border-hairline">
        {subs.map((s) => (
          <button
            key={s.id}
            onClick={() => openIssue(s.id)}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-1"
          >
            <StateIcon state={stateById.get(s.stateId)} />
            <span className="font-mono text-[11px] text-ink-tertiary">{s.key}</span>
            <span className="truncate text-[13px] text-ink-muted">{s.title}</span>
          </button>
        ))}
        {subs.length === 0 && !adding && (
          <div className="px-2.5 py-2 text-[13px] text-ink-tertiary">No sub-issues</div>
        )}
        {adding && (
          <div className="flex items-center gap-1.5 p-1.5">
            <Input
              autoFocus
              placeholder="Sub-issue title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setAdding(false);
                  setTitle("");
                }
              }}
            />
            <button className="rounded p-1.5 text-ink-tertiary hover:text-ink" onClick={() => setAdding(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
