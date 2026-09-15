import type { EntityName, Op } from "@offlinear/shared";

export type PushResult =
  | { ok: true; rev: number }
  | { ok: false; conflict: "base-rev-mismatch" | "missing"; server?: unknown };

export interface PullResult {
  rows: { entity: EntityName; row: Record<string, unknown>; deleted?: boolean }[];
  cursor: string | null;
}

/**
 * A SyncAdapter is the boundary between the local outbox and an authoritative
 * store. The client is written entirely against this interface; Phase 1 ships a
 * LocalAdapter (single-device), and an AppwriteAdapter drops in later without
 * touching the engine, mutations, or UI.
 */
export interface SyncAdapter {
  readonly name: string;
  push(op: Op): Promise<PushResult>;
  pullSince(cursor: string | null): Promise<PullResult>;
  subscribe?(onChange: (r: PullResult) => void): () => void;
}
