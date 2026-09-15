import { applyOp, type EntityName, type Op, type Synced } from "@offlinear/shared";
import { create } from "zustand";
import { db, type OutboxEntry } from "@/db/db";
import type { SyncAdapter } from "./adapter";
import { LocalAdapter } from "./local-adapter";

// The tables an op can target, resolved by name.
const tableFor = (entity: EntityName) => db[entity] as unknown as {
  get(id: string): Promise<Synced | undefined>;
  put(row: Synced): Promise<unknown>;
  delete(id: string): Promise<unknown>;
};

interface SyncState {
  mode: string;
  online: boolean;
  pending: number;
  syncing: boolean;
  setOnline: (v: boolean) => void;
  refresh: () => Promise<void>;
}

export const useSync = create<SyncState>((set) => ({
  mode: "local",
  online: navigator.onLine,
  pending: 0,
  syncing: false,
  setOnline: (v) => {
    set({ online: v });
    if (v) void drain();
  },
  refresh: async () => set({ pending: await db.outbox.where("status").notEqual("synced").count() }),
}));

let adapter: SyncAdapter = new LocalAdapter();
export function setAdapter(a: SyncAdapter) {
  adapter = a;
  useSync.setState({ mode: a.name });
}

/**
 * The single write path. Applies an op optimistically to the local mirror, then
 * enqueues it for the adapter. The UI re-renders from Dexie immediately — the
 * network never blocks a keystroke.
 */
export async function commit(op: Op): Promise<void> {
  const table = tableFor(op.entity);
  const current = await table.get(op.entityId);
  const { next } = applyOp(current as Synced | undefined, op as Op<Partial<Synced>>);

  await db.transaction("rw", [db[op.entity] as never, db.outbox], async () => {
    if (next) await table.put(next);
    else await table.delete(op.entityId);
    await db.outbox.put({
      opId: op.opId,
      op,
      status: "pending",
      editedAt: op.createdAt,
      attempts: 0,
    });
  });

  await useSync.getState().refresh();
  void drain();
}

let draining = false;

/** Drain the outbox in order. Called after each commit and on reconnect. */
export async function drain(): Promise<void> {
  if (draining || !useSync.getState().online) return;
  draining = true;
  useSync.setState({ syncing: true });
  try {
    const pending = await db.outbox
      .where("status")
      .anyOf("pending", "failed")
      .sortBy("op.createdAt");

    for (const entry of pending) {
      await processEntry(entry);
    }
  } finally {
    draining = false;
    useSync.setState({ syncing: false });
    await useSync.getState().refresh();
  }
}

async function processEntry(entry: OutboxEntry): Promise<void> {
  await db.outbox.update(entry.opId, { status: "syncing" });
  try {
    const res = await adapter.push(entry.op);
    if (res.ok) {
      // Ack: the outbox entry is done. (Rev reconciliation with a real server
      // happens in the AppwriteAdapter path.)
      await db.outbox.delete(entry.opId);
    } else {
      await db.outbox.update(entry.opId, {
        status: "failed",
        attempts: entry.attempts + 1,
        error: res.conflict,
      });
    }
  } catch (e) {
    await db.outbox.update(entry.opId, {
      status: "failed",
      attempts: entry.attempts + 1,
      error: String(e),
    });
  }
}

/** Wire browser online/offline into the engine. Call once at startup. */
export function initSync(): void {
  window.addEventListener("online", () => useSync.getState().setOnline(true));
  window.addEventListener("offline", () => useSync.getState().setOnline(false));
  void drain();
}
