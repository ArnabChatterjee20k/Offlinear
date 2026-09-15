import { Plus, X } from "lucide-react";
import type { Issue, RelationKind } from "@offlinear/shared";
import { StateIcon } from "./icons";
import { IssueSearch } from "./IssueSearch";
import { useIssuesByIds, useLookups } from "@/hooks/useData";
import { useUI } from "@/store/ui";
import { linkRelation, unlinkRelation } from "@/store/mutations";

function RelationGroup({
  issue,
  kind,
  title,
  ids,
}: {
  issue: Issue;
  kind: RelationKind;
  title: string;
  ids: string[];
}) {
  const linked = useIssuesByIds(ids);
  const { stateById } = useLookups();
  const openIssue = useUI((s) => s.openIssue);
  if (ids.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">{title}</div>
      {linked.map((r) => (
        <div key={r.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-surface-1">
          <button onClick={() => openIssue(r.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <StateIcon state={stateById.get(r.stateId)} />
            <span className="font-mono text-[11px] text-ink-tertiary">{r.key}</span>
            <span className="truncate text-[13px] text-ink-muted">{r.title}</span>
          </button>
          <button
            className="rounded p-0.5 text-ink-tertiary opacity-0 hover:text-danger group-hover:opacity-100"
            onClick={() => unlinkRelation(issue.id, kind, r.id)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Relations({ issue }: { issue: Issue }) {
  const dup = useIssuesByIds(issue.duplicateOfId ? [issue.duplicateOfId] : []);
  const { stateById } = useLookups();
  const openIssue = useUI((s) => s.openIssue);
  const hasAny =
    issue.blockedByIds.length || issue.relatedIds.length || issue.duplicateOfId;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-ink-subtle">Relations</h3>
        <div className="flex gap-1">
          <AddRelation issue={issue} kind="blocked_by" label="Blocked by" />
          <AddRelation issue={issue} kind="related" label="Related" />
          <AddRelation issue={issue} kind="duplicate_of" label="Duplicate of" />
        </div>
      </div>

      {!hasAny && <div className="text-[13px] text-ink-tertiary">No relations</div>}

      <RelationGroup issue={issue} kind="blocked_by" title="Blocked by" ids={issue.blockedByIds} />
      <RelationGroup issue={issue} kind="related" title="Related" ids={issue.relatedIds} />

      {issue.duplicateOfId && dup[0] && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">Duplicate of</div>
          <div className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-surface-1">
            <button onClick={() => openIssue(dup[0].id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <StateIcon state={stateById.get(dup[0].stateId)} />
              <span className="font-mono text-[11px] text-ink-tertiary">{dup[0].key}</span>
              <span className="truncate text-[13px] text-ink-muted">{dup[0].title}</span>
            </button>
            <button
              className="rounded p-0.5 text-ink-tertiary opacity-0 hover:text-danger group-hover:opacity-100"
              onClick={() => unlinkRelation(issue.id, "duplicate_of", dup[0].id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddRelation({ issue, kind, label }: { issue: Issue; kind: RelationKind; label: string }) {
  return (
    <IssueSearch
      excludeId={issue.id}
      onPick={(id) => linkRelation(issue.id, kind, id)}
      trigger={
        <button
          title={`Add ${label}`}
          className="flex items-center gap-1 rounded-md border border-hairline px-1.5 py-0.5 text-[11px] text-ink-subtle hover:border-hairline-strong hover:text-ink"
        >
          <Plus className="h-3 w-3" />
          {label}
        </button>
      }
    />
  );
}
