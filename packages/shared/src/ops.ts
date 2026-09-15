// Operations are the single write primitive. The UI, the command palette, and
// agents all produce Ops; nothing writes an entity any other way.

import type { EntityName } from "./types.js";

export type OpType = "create" | "update" | "delete";

export interface Op<T = Record<string, unknown>> {
  opId: string; // client-generated uuid, used for idempotent replay
  entity: EntityName;
  entityId: string;
  type: OpType;
  /** For create: the full row (minus server fields). For update: a partial patch. */
  patch: Partial<T>;
  /** The `rev` the op was built on. Server applies only if it still matches. */
  baseRev: number;
  createdAt: string; // ISO
  /** Who authored it — a member id, or a bot handle for agents. */
  actorId: string | null;
}

export function newOpId(): string {
  // crypto.randomUUID exists in browsers and Node 19+.
  return crypto.randomUUID();
}

export function makeOp<T>(
  input: Omit<Op<T>, "opId" | "createdAt">
): Op<T> {
  return { ...input, opId: newOpId(), createdAt: new Date().toISOString() };
}
