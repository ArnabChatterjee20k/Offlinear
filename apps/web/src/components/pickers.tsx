import * as React from "react";
import { PRIORITY_LABELS, type Issue, type Priority } from "@offlinear/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { PriorityIcon, StateIcon } from "./icons";
import { Avatar } from "./ui/primitives";
import { useLookups } from "@/hooks/useData";
import { setAssignee, setPriority, moveIssue, toggleLabel } from "@/store/mutations";

function Menu({
  trigger,
  label,
  children,
}: {
  trigger: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StatePicker({ issue, trigger }: { issue: Issue; trigger: React.ReactNode }) {
  const { states } = useLookups();
  return (
    <Menu trigger={trigger} label="Change status">
      {states.map((s) => (
        <DropdownMenuItem
          key={s.id}
          selected={s.id === issue.stateId}
          onSelect={() => moveIssue(issue.id, s.id)}
        >
          <StateIcon state={s} />
          {s.name}
        </DropdownMenuItem>
      ))}
    </Menu>
  );
}

const PRIORITIES: Priority[] = [1, 2, 3, 4, 0];

export function PriorityPicker({ issue, trigger }: { issue: Issue; trigger: React.ReactNode }) {
  return (
    <Menu trigger={trigger} label="Change priority">
      {PRIORITIES.map((p) => (
        <DropdownMenuItem
          key={p}
          selected={p === issue.priority}
          onSelect={() => setPriority(issue.id, p)}
        >
          <PriorityIcon priority={p} />
          {PRIORITY_LABELS[p]}
        </DropdownMenuItem>
      ))}
    </Menu>
  );
}

export function AssigneePicker({ issue, trigger }: { issue: Issue; trigger: React.ReactNode }) {
  const { members } = useLookups();
  return (
    <Menu trigger={trigger} label="Assign to">
      <DropdownMenuItem selected={issue.assigneeId == null} onSelect={() => setAssignee(issue.id, null)}>
        <span className="grid h-5 w-5 place-items-center rounded-full border border-dashed border-hairline-strong text-ink-tertiary">
          ?
        </span>
        Unassigned
      </DropdownMenuItem>
      {members
        .filter((m) => !m.isAgent)
        .map((m) => (
          <DropdownMenuItem
            key={m.id}
            selected={m.id === issue.assigneeId}
            onSelect={() => setAssignee(issue.id, m.id)}
          >
            <Avatar name={m.name} />
            {m.name}
          </DropdownMenuItem>
        ))}
    </Menu>
  );
}

export function LabelPicker({ issue, trigger }: { issue: Issue; trigger: React.ReactNode }) {
  const { labels } = useLookups();
  return (
    <Menu trigger={trigger} label="Toggle labels">
      {labels.map((l) => (
        <DropdownMenuItem
          key={l.id}
          selected={issue.labelIds.includes(l.id)}
          onSelect={(e) => {
            e.preventDefault(); // keep menu open for multi-toggle
            toggleLabel(issue.id, l.id);
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
          {l.name}
        </DropdownMenuItem>
      ))}
      {labels.length === 0 && <div className="px-2 py-1.5 text-[13px] text-ink-tertiary">No labels</div>}
    </Menu>
  );
}
