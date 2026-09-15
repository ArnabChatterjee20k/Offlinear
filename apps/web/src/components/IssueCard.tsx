import * as React from "react";
import { GitBranch, Link2, Ban } from "lucide-react";
import type { Issue } from "@offlinear/shared";
import { cn } from "@/lib/utils";
import { PriorityIcon, StateIcon } from "./icons";
import { Avatar } from "./ui/primitives";
import { PriorityPicker, StatePicker } from "./pickers";
import { useLookupCtx } from "@/hooks/lookups";

interface Props {
  issue: Issue;
  focused?: boolean;
  selected?: boolean;
  showState?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  dragHandleProps?: Record<string, unknown>;
}

/** A stop-propagation wrapper so inline pickers don't trigger drag/open. */
const Stop = ({ children }: { children: React.ReactNode }) => (
  <span onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
    {children}
  </span>
);

export const IssueCard = React.forwardRef<HTMLDivElement, Props>(function IssueCard(
  { issue, focused, selected, showState, onClick, dragHandleProps },
  ref
) {
  const { stateById, memberById, labelById, subCountByParent } = useLookupCtx();
  const subs = subCountByParent.get(issue.id);
  const assignee = issue.assigneeId ? memberById.get(issue.assigneeId) : undefined;
  const blocked = issue.blockedByIds.length > 0;

  return (
    <div
      ref={ref}
      data-issue-id={issue.id}
      onClick={onClick}
      className={cn(
        "group cursor-pointer select-none rounded-lg border bg-surface-1 p-2.5 hairline-t transition-colors",
        "hover:border-hairline-strong",
        focused ? "border-brand/70 ring-1 ring-brand/40" : "border-hairline",
        selected && "border-brand !bg-brand/10 ring-1 ring-brand"
      )}
      {...dragHandleProps}
    >
      <div className="flex items-start gap-2">
        <Stop>
          <PriorityPicker
            issue={issue}
            trigger={
              <button className="mt-0.5 rounded p-0.5 hover:bg-surface-3">
                <PriorityIcon priority={issue.priority} />
              </button>
            }
          />
        </Stop>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-tertiary">
            {showState && (
              <Stop>
                <StatePicker
                  issue={issue}
                  trigger={
                    <button className="rounded p-0.5 hover:bg-surface-3">
                      <StateIcon state={stateById.get(issue.stateId)} />
                    </button>
                  }
                />
              </Stop>
            )}
            <span>{issue.key}</span>
            {blocked && (
              <span title="Blocked" className="flex items-center gap-0.5 text-danger">
                <Ban className="h-3 w-3" />
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink">{issue.title}</p>

          {(issue.labelIds.length > 0 || subs || issue.relatedIds.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {issue.labelIds.map((id) => {
                const l = labelById.get(id);
                if (!l) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-hairline px-1.5 py-0.5 text-[10px] text-ink-subtle"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                    {l.name}
                  </span>
                );
              })}
              {subs && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-tertiary">
                  <GitBranch className="h-3 w-3" />
                  {subs.done}/{subs.total}
                </span>
              )}
              {issue.relatedIds.length > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-tertiary">
                  <Link2 className="h-3 w-3" />
                  {issue.relatedIds.length}
                </span>
              )}
            </div>
          )}
        </div>
        {assignee && <Avatar name={assignee.name} size={18} className="mt-0.5" />}
      </div>
    </div>
  );
});
