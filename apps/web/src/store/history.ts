import { create } from "zustand";
import { makeOp, type EntityName, type Synced } from "@offlinear/shared";
import { db } from "@/db/db";
import { commit } from "@/sync/engine";
import { getActorId } from "./session";

export interface Change {
  entity: EntityName;
  id: string;
  before: Synced | null;
  after: Synced | null;
}

interface HistoryState {
  undo: Change[][];
  redo: Change[][];
  batching: boolean;
  pending: Change[];
  canUndo: boolean;
  canRedo: boolean;
}

export const useHistory = create<HistoryState>(() => ({
  undo: [],
  redo: [],
  batching: false,
  pending: [],
  canUndo: false,
  canRedo: false,
}));

const sync = () =>
  useHistory.setState((s) => ({ canUndo: s.undo.length > 0, canRedo: s.redo.length > 0 }));

/** Record one applied change. Grouped into the open batch if there is one. */
export function pushChange(c: Change): void {
  const s = useHistory.getState();
  if (s.batching) {
    useHistory.setState({ pending: [...s.pending, c] });
  } else {
    useHistory.setState({ undo: [...s.undo, [c]], redo: [] });
    sync();
  }
}

/** Group everything committed inside `fn` into a single undo entry. */
export async function batch(fn: () => Promise<void>): Promise<void> {
  useHistory.setState({ batching: true, pending: [] });
  try {
    await fn();
  } finally {
    const p = useHistory.getState().pending;
    useHistory.setState((s) => ({
      batching: false,
      pending: [],
      undo: p.length ? [...s.undo, p] : s.undo,
      redo: p.length ? [] : s.redo,
    }));
    sync();
  }
}

/** Set a row back to `target` (or delete it if null) without recording history. */
async function restore(entity: EntityName, id: string, target: Synced | null): Promise<void> {
  const table = db[entity] as unknown as { get(id: string): Promise<Synced | undefined> };
  const current = await table.get(id);
  const actorId = getActorId();

  if (!target) {
    if (current) {
      await commit(
        makeOp({ entity, entityId: id, type: "delete", patch: {}, baseRev: current.rev, actorId }),
        { record: false }
      );
    }
    return;
  }
  const { id: _omit, ...fields } = target;
  if (current) {
    await commit(
      makeOp({ entity, entityId: id, type: "update", patch: fields, baseRev: current.rev, actorId }),
      { record: false }
    );
  } else {
    await commit(
      makeOp({ entity, entityId: id, type: "create", patch: { ...fields, id }, baseRev: 0, actorId }),
      { record: false }
    );
  }
}

export async function undo(): Promise<void> {
  const s = useHistory.getState();
  const group = s.undo.at(-1);
  if (!group) return;
  useHistory.setState({ undo: s.undo.slice(0, -1), redo: [...s.redo, group] });
  sync();
  for (const c of [...group].reverse()) await restore(c.entity, c.id, c.before);
}

export async function redo(): Promise<void> {
  const s = useHistory.getState();
  const group = s.redo.at(-1);
  if (!group) return;
  useHistory.setState({ redo: s.redo.slice(0, -1), undo: [...s.undo, group] });
  sync();
  for (const c of group) await restore(c.entity, c.id, c.after);
}
