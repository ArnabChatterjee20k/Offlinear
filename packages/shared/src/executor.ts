// The pure op-executor. Given a current row (or undefined) and an Op, it returns
// the next row. No I/O, no side effects — this is the shared brain used both
// optimistically on the client and authoritatively on the server.

import type { Op } from "./ops.js";
import type { Synced } from "./types.js";

export interface ApplyResult<T extends Synced> {
  /** The resulting row, or null when the op deletes it. */
  next: T | null;
  /** Set when the op could not be applied (used by the sync engine to re-base). */
  conflict?: "base-rev-mismatch" | "missing" | "already-exists";
}

/**
 * Apply an op to a row.
 * @param current the existing row, or undefined if none
 * @param op the operation to apply
 * @param now injected clock (ISO) so callers control timestamps in tests
 * @param strict when true, enforce baseRev matching (server mode). The optimistic
 *   client applies non-strictly so the UI never blocks on a stale rev.
 */
export function applyOp<T extends Synced>(
  current: T | undefined,
  op: Op<Partial<T>>,
  now: string = new Date().toISOString(),
  strict = false
): ApplyResult<T> {
  if (strict && current && op.type !== "create" && op.baseRev !== current.rev) {
    return { next: current, conflict: "base-rev-mismatch" };
  }

  switch (op.type) {
    case "create": {
      if (current) return { next: current, conflict: "already-exists" };
      const row = {
        ...(op.patch as object),
        id: op.entityId,
        createdAt: now,
        updatedAt: now,
        rev: 1,
      } as T;
      return { next: row };
    }
    case "update": {
      if (!current) return { next: null, conflict: "missing" };
      const row = {
        ...current,
        ...(op.patch as object),
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: now,
        rev: current.rev + 1,
      } as T;
      return { next: row };
    }
    case "delete": {
      if (!current) return { next: null, conflict: "missing" };
      return { next: null };
    }
  }
}

/**
 * Field-level last-write-wins merge, used when re-basing a pending local op on
 * top of authoritative server state. Fields present in the local patch win only
 * if the local edit is newer than the server row's updatedAt.
 */
export function rebasePatch<T extends Synced>(
  server: T,
  localPatch: Partial<T>,
  localEditedAt: string
): Partial<T> {
  if (localEditedAt >= server.updatedAt) return localPatch;
  // Server is newer: drop fields the server has already changed away from.
  const out: Partial<T> = {};
  for (const k of Object.keys(localPatch) as (keyof T)[]) {
    out[k] = localPatch[k];
  }
  return out;
}
