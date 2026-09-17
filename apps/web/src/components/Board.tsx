import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Columns3 } from "lucide-react";
import type { Issue, State } from "@offlinear/shared";
import { cn } from "@/lib/utils";
import { StateIcon } from "./icons";
import { IssueCard } from "./IssueCard";
import { ManageColumns } from "./ManageColumns";
import { useBoardIssues, useStates } from "@/hooks/useData";
import { LookupProvider } from "@/hooks/lookups";
import { useUI } from "@/store/ui";
import { moveIssue, updateIssue, updateState } from "@/store/mutations";
import { batch } from "@/store/history";
import { boardCardIds } from "@/lib/board-order";

const COL = "col:"; // sortable-id prefix for columns (vs card ids)

const PAGE = 25;

/** Click behaviour: plain = open (clears selection); ⌘/Ctrl = toggle one;
 *  Shift = select the range from the anchor to this card. */
function handleCardClick(e: React.MouseEvent, id: string) {
  const ui = useUI.getState();
  if (e.shiftKey) {
    e.preventDefault();
    const ids = boardCardIds();
    const anchor = ui.anchorId ?? ui.focusedIssueId ?? id;
    const a = ids.indexOf(anchor);
    const b = ids.indexOf(id);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      ui.addSelection(ids.slice(lo, hi + 1));
    } else ui.toggleSelect(id);
    ui.setFocus(id);
  } else if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    ui.toggleSelect(id);
    ui.setFocus(id);
  } else if (ui.shiftHeld || ui.selection.size > 0) {
    ui.toggleSelect(id);
    ui.setFocus(id);
  } else {
    ui.setAnchor(id);
    ui.setFocus(id);
    ui.openIssue(id);
  }
}

function SortableCard({ issue, focused }: { issue: Issue; focused: boolean }) {
  const selected = useUI((s) => s.selection.has(issue.id));
  const selectable = useUI((s) => s.shiftHeld || s.selection.size > 0);
  const toggleSelect = useUI((s) => s.toggleSelect);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <IssueCard
        issue={issue}
        focused={focused}
        selected={selected}
        selectable={selectable}
        onToggleSelect={toggleSelect}
        onClick={(e) => handleCardClick(e, issue.id)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function Column({ state, ids, issueById }: { state: State; ids: string[]; issueById: Map<string, Issue> }) {
  const { setNodeRef, isOver } = useDroppable({ id: state.id });
  const col = useSortable({ id: COL + state.id });
  const focusedId = useUI((s) => s.focusedIssueId);
  const openCreate = useUI((s) => s.openCreate);
  const [visible, setVisible] = React.useState(PAGE);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240 && visible < ids.length) {
      setVisible((v) => Math.min(v + PAGE, ids.length));
    }
  };

  const shown = ids.slice(0, visible);

  return (
    <div
      ref={col.setNodeRef}
      style={{ transform: CSS.Translate.toString(col.transform), transition: col.transition }}
      className={cn("flex h-full w-[300px] shrink-0 flex-col", col.isDragging && "opacity-60")}
    >
      <div className="group mb-2 flex items-center gap-2 px-1">
        <button
          {...col.attributes}
          {...col.listeners}
          className="cursor-grab text-ink-tertiary opacity-0 hover:text-ink group-hover:opacity-100 active:cursor-grabbing"
          title="Drag to reorder column"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <StateIcon state={state} size={15} />
        <span className="text-[13px] font-medium text-ink">{state.name}</span>
        <span className="text-[12px] text-ink-tertiary">{ids.length}</span>
        <button
          className="ml-auto rounded p-1 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
          title="New issue in this state"
          onClick={() => openCreate({ stateId: state.id })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <SortableContext items={shown} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          onScroll={onScroll}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-1 transition-colors",
            isOver && "bg-surface-1/50 ring-1 ring-inset ring-brand/30"
          )}
        >
          {shown.map((id) => {
            const issue = issueById.get(id);
            return issue ? (
              <SortableCard key={id} issue={issue} focused={id === focusedId} />
            ) : null;
          })}
          {visible < ids.length && (
            <div className="py-2 text-center text-[11px] text-ink-tertiary">
              {ids.length - visible} more…
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function Board() {
  const states = useStates();
  const issues = useBoardIssues();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const issueById = React.useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);

  // Ordered ids per column, derived from the data; overridden locally while
  // dragging so cross-column moves preview immediately.
  const derived = React.useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const s of states) m[s.id] = [];
    for (const i of issues) (m[i.stateId] ??= []).push(i.id);
    for (const s of states)
      m[s.id]?.sort((a, b) => (issueById.get(a)!.boardOrder - issueById.get(b)!.boardOrder));
    return m;
  }, [states, issues, issueById]);

  const [items, setItems] = React.useState<Record<string, string[]>>(derived);
  React.useEffect(() => {
    if (!activeId) setItems(derived);
  }, [derived, activeId]);

  const findContainer = (id: string): string | null => {
    if (items[id]) return id; // it's a column id
    return Object.keys(items).find((k) => items[k].includes(id)) ?? null;
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id);
    if (activeId.startsWith(COL)) return; // column drag handled on end
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = findContainer(activeId);
    const to = items[overId] ? overId : findContainer(overId);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const fromItems = prev[from].filter((x) => x !== activeId);
      const overItems = prev[to];
      const overIndex = items[overId] ? overItems.length : overItems.indexOf(overId);
      const idx = overIndex < 0 ? overItems.length : overIndex;
      return {
        ...prev,
        [from]: fromItems,
        [to]: [...overItems.slice(0, idx), activeId, ...overItems.slice(idx)],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!overId) {
      setItems(derived);
      return;
    }

    // Column reorder → fractional position between neighbours.
    if (id.startsWith(COL)) {
      const activeState = id.slice(COL.length);
      const overState = overId.startsWith(COL) ? overId.slice(COL.length) : findContainer(overId);
      if (!overState || activeState === overState) return;
      const order = states.map((s) => s.id);
      const finalOrder = arrayMove(order, order.indexOf(activeState), order.indexOf(overState));
      const pos = finalOrder.indexOf(activeState);
      const posOf = (sid?: string) => states.find((s) => s.id === sid)?.position ?? null;
      const prev = pos > 0 ? posOf(finalOrder[pos - 1]) : null;
      const next = pos < finalOrder.length - 1 ? posOf(finalOrder[pos + 1]) : null;
      const newPos =
        prev == null && next == null ? 0 : prev == null ? next! - 1 : next == null ? prev + 1 : (prev + next) / 2;
      void updateState(activeState, { position: newPos });
      return;
    }
    const to = items[overId] ? overId : findContainer(overId);
    if (!to) {
      setItems(derived);
      return;
    }

    // Multi-select: move the whole selection to the target column (appended).
    const sel = useUI.getState().selection;
    if (sel.has(id) && sel.size > 1) {
      void batch(async () => {
        for (const sid of sel) {
          const iss = issueById.get(sid);
          if (iss && iss.stateId !== to) await moveIssue(sid, to);
        }
      });
      setItems(derived);
      return;
    }

    // Reorder within the target column and compute a fractional boardOrder.
    const list = items[to];
    const oldIndex = list.indexOf(id);
    const overIndex = items[overId] ? list.length - 1 : list.indexOf(overId);
    const finalList = arrayMove(list, oldIndex, overIndex < 0 ? list.length - 1 : overIndex);
    const pos = finalList.indexOf(id);
    const prevOrder = pos > 0 ? issueById.get(finalList[pos - 1])?.boardOrder ?? null : null;
    const nextOrder =
      pos < finalList.length - 1 ? issueById.get(finalList[pos + 1])?.boardOrder ?? null : null;
    const newOrder =
      prevOrder == null && nextOrder == null
        ? 1
        : prevOrder == null
          ? nextOrder! - 1
          : nextOrder == null
            ? prevOrder + 1
            : (prevOrder + nextOrder) / 2;

    const issue = issueById.get(id);
    if (issue && issue.stateId !== to) void moveIssue(id, to, newOrder);
    else void updateIssue(id, { boardOrder: newOrder });
  }

  const active = activeId ? issueById.get(activeId) : null;
  const selection = useUI((s) => s.selection);
  const dragCount = activeId && selection.has(activeId) ? selection.size : 1;
  const [manageOpen, setManageOpen] = React.useState(false);

  return (
    <LookupProvider>
      <div className="flex items-center justify-between px-6 pt-3">
        <span className="text-[12px] text-ink-tertiary">
          Drag cards to reorder, or drag a column by its handle
        </span>
        <button
          onClick={() => setManageOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink"
        >
          <Columns3 className="h-3.5 w-3.5" /> Manage columns
        </button>
      </div>
      <ManageColumns open={manageOpen} onClose={() => setManageOpen(false)} />
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div id="board" className="flex h-[calc(100%-2.75rem)] gap-4 overflow-x-auto px-6 pb-4 pt-2">
          <SortableContext items={states.map((s) => COL + s.id)} strategy={horizontalListSortingStrategy}>
            {states.map((s) => (
              <Column key={s.id} state={s} ids={items[s.id] ?? []} issueById={issueById} />
            ))}
          </SortableContext>
          <div className="w-2 shrink-0" />
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="relative w-[290px] rotate-1">
              <IssueCard issue={active} />
              {dragCount > 1 && (
                <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-[12px] font-medium text-white shadow-lg">
                  {dragCount}
                </span>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </LookupProvider>
  );
}
