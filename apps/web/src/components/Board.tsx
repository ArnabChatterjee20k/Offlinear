import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { Issue, State } from "@offlinear/shared";
import { cn } from "@/lib/utils";
import { StateIcon } from "./icons";
import { IssueCard } from "./IssueCard";
import { useBoardIssues, useStates } from "@/hooks/useData";
import { LookupProvider } from "@/hooks/lookups";
import { useUI } from "@/store/ui";
import { moveIssue } from "@/store/mutations";

const PAGE = 25; // cards rendered per column before lazy-loading more

function DraggableCard({ issue, focused }: { issue: Issue; focused: boolean }) {
  const openIssue = useUI((s) => s.openIssue);
  const selected = useUI((s) => s.selection.has(issue.id));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: issue.id });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <IssueCard
        issue={issue}
        focused={focused}
        selected={selected}
        onOpen={openIssue}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function Column({ state, issues }: { state: State; issues: Issue[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: state.id });
  const focusedId = useUI((s) => s.focusedIssueId);
  const openCreate = useUI((s) => s.openCreate);
  const [visible, setVisible] = React.useState(PAGE);

  // Grow the window as the user nears the bottom (lazy render).
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight < 240 &&
      visible < issues.length
    ) {
      setVisible((v) => Math.min(v + PAGE, issues.length));
    }
  };

  const shown = issues.slice(0, visible);

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <StateIcon state={state} size={15} />
        <span className="text-[13px] font-medium text-ink">{state.name}</span>
        <span className="text-[12px] text-ink-tertiary">{issues.length}</span>
        <button
          className="ml-auto rounded p-1 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
          title="New issue in this state"
          onClick={() => openCreate({ stateId: state.id })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        onScroll={onScroll}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-1 transition-colors",
          isOver && "bg-surface-1/50 ring-1 ring-inset ring-brand/30"
        )}
      >
        {shown.map((issue) => (
          <DraggableCard key={issue.id} issue={issue} focused={issue.id === focusedId} />
        ))}
        {visible < issues.length && (
          <div className="py-2 text-center text-[11px] text-ink-tertiary">
            {issues.length - visible} more…
          </div>
        )}
      </div>
    </div>
  );
}

export function Board() {
  const states = useStates();
  const issues = useBoardIssues();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byState = React.useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const s of states) m.set(s.id, []);
    for (const i of issues) (m.get(i.stateId) ?? m.set(i.stateId, []).get(i.stateId)!).push(i);
    for (const list of m.values()) list.sort((a, b) => a.boardOrder - b.boardOrder);
    return m;
  }, [states, issues]);

  const active = activeId ? issues.find((i) => i.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const over = e.over?.id ? String(e.over.id) : null;
    const id = String(e.active.id);
    if (!over) return;
    const issue = issues.find((i) => i.id === id);
    if (issue && issue.stateId !== over) void moveIssue(id, over);
  }

  return (
    <LookupProvider>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div id="board" className="flex h-full gap-4 overflow-x-auto px-6 py-4">
          {states.map((s) => (
            <Column key={s.id} state={s} issues={byState.get(s.id) ?? []} />
          ))}
          <div className="w-2 shrink-0" />
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="w-[290px] rotate-1">
              <IssueCard issue={active} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </LookupProvider>
  );
}
