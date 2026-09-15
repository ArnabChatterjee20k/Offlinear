import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  CircleDot,
  Flag,
  Plus,
  Tag,
  User,
} from "lucide-react";
import {
  PRIORITY_LABELS,
  type Priority,
} from "@offlinear/shared";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { PriorityIcon, StateIcon } from "./icons";
import { Avatar } from "./ui/primitives";
import { db } from "@/db/db";
import { useLookups } from "@/hooks/useData";
import { useUI } from "@/store/ui";
import {
  createIssue,
  moveIssue,
  setAssignee,
  setPriority,
  toggleLabel,
} from "@/store/mutations";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  run: () => void;
  keepOpen?: boolean;
}

export function CommandPalette() {
  const { palette, closePalette, openPalette, openIssue, focusedIssueId, selection } = useUI();
  const { states, members, labels, stateById } = useLookups();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    if (palette.open) {
      setQ("");
      setActive(0);
    }
  }, [palette.open, palette.mode]);

  // Effective targets: explicit, else selection, else focused card.
  const targets =
    palette.targets.length > 0
      ? palette.targets
      : selection.size > 0
        ? [...selection]
        : focusedIssueId
          ? [focusedIssueId]
          : [];

  const matches = useLiveQuery(async () => {
    const term = q.trim().toLowerCase();
    const all = await db.issues.limit(2000).toArray();
    return all
      .filter((i) => !term || i.key.toLowerCase().includes(term) || i.title.toLowerCase().includes(term))
      .slice(0, 6);
  }, [q, palette.mode]) ?? [];

  const rows: Row[] = React.useMemo(() => {
    const apply = (fn: (t: string) => void) => targets.forEach(fn);

    if (palette.mode === "status") {
      return states.map((s) => ({
        id: s.id,
        label: s.name,
        icon: <StateIcon state={s} />,
        run: () => apply((t) => moveIssue(t, s.id)),
      }));
    }
    if (palette.mode === "priority") {
      return ([1, 2, 3, 4, 0] as Priority[]).map((p) => ({
        id: String(p),
        label: PRIORITY_LABELS[p],
        icon: <PriorityIcon priority={p} />,
        run: () => apply((t) => setPriority(t, p)),
      }));
    }
    if (palette.mode === "assignee") {
      return [
        { id: "none", label: "Unassigned", run: () => apply((t) => setAssignee(t, null)) },
        ...members
          .filter((m) => !m.isAgent)
          .map((m) => ({
            id: m.id,
            label: m.name,
            icon: <Avatar name={m.name} size={16} />,
            run: () => apply((t) => setAssignee(t, m.id)),
          })),
      ];
    }
    if (palette.mode === "label") {
      return labels.map((l) => ({
        id: l.id,
        label: l.name,
        icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />,
        keepOpen: true,
        run: () => apply((t) => toggleLabel(t, l.id)),
      }));
    }

    // Root mode
    const root: Row[] = [
      {
        id: "new",
        label: q.trim() ? `Create issue “${q.trim()}”` : "Create new issue",
        icon: <Plus className="h-4 w-4" />,
        hint: "C",
        run: () => createIssue({ title: q.trim() || "New issue" }).then((id) => openIssue(id)),
      },
    ];
    if (targets.length > 0) {
      const suffix = targets.length > 1 ? ` (${targets.length})` : "";
      root.push(
        { id: "s", label: `Set status${suffix}`, icon: <CircleDot className="h-4 w-4" />, hint: "S", run: () => openPalette("status", targets) },
        { id: "p", label: `Set priority${suffix}`, icon: <Flag className="h-4 w-4" />, hint: "P", run: () => openPalette("priority", targets) },
        { id: "a", label: `Assign${suffix}`, icon: <User className="h-4 w-4" />, hint: "A", run: () => openPalette("assignee", targets) },
        { id: "l", label: `Labels${suffix}`, icon: <Tag className="h-4 w-4" />, hint: "L", run: () => openPalette("label", targets) }
      );
    }
    const issueRows: Row[] = matches.map((i) => ({
      id: i.id,
      label: i.title,
      icon: <StateIcon state={stateById.get(i.stateId)} />,
      hint: i.key,
      run: () => openIssue(i.id),
    }));
    return [...root, ...issueRows];
  }, [palette.mode, q, targets, states, members, labels, matches, stateById, openIssue, openPalette]);

  const runRow = (row: Row) => {
    row.run();
    if (!row.keepOpen) closePalette();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) runRow(row);
    }
  };

  const placeholder =
    palette.mode === "root" ? "Type a command or search issues…" : `Choose ${palette.mode}…`;

  return (
    <Dialog open={palette.open} onOpenChange={(o) => !o && closePalette()}>
      <DialogContent aria-describedby={undefined} className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full border-b border-hairline bg-transparent px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-ink-tertiary"
        />
        <div className="max-h-[340px] overflow-y-auto p-1.5">
          {rows.map((row, i) => (
            <button
              key={row.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => runRow(row)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]",
                i === active ? "bg-surface-4 text-ink" : "text-ink-muted"
              )}
            >
              <span className="grid h-4 w-4 place-items-center text-ink-subtle">{row.icon}</span>
              <span className="flex-1 truncate">{row.label}</span>
              {row.hint && <span className="font-mono text-[10px] text-ink-tertiary">{row.hint}</span>}
              {(palette.mode !== "root" || row.id.length > 3) && i === active && (
                <ArrowRight className="h-3.5 w-3.5 text-ink-tertiary" />
              )}
            </button>
          ))}
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-ink-tertiary">No results</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
