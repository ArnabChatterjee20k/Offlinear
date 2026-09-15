import Dexie, { type EntityTable } from "dexie";
import type {
  Comment,
  Issue,
  Label,
  Member,
  Op,
  Priority,
  State,
  Team,
} from "@offlinear/shared";

/** Local mapping between an issue and its GitHub Projects v2 item. */
export interface GhMap {
  issueId: string;
  itemId: string;
  projectId: string;
}

/** An unsent issue being composed. Local-only; never synced. */
export interface Draft {
  id: string;
  title: string;
  description: string;
  stateId: string | null;
  priority: Priority;
  assigneeId: string | null;
  labelIds: string[];
  updatedAt: string;
}

// Outbox entry: a pending op plus its local sync bookkeeping.
export interface OutboxEntry {
  opId: string;
  op: Op;
  status: "pending" | "syncing" | "synced" | "failed";
  editedAt: string; // for field-level LWW re-basing
  attempts: number;
  error?: string;
}

export interface Meta {
  key: string;
  value: unknown;
}

// The local mirror of Appwrite TablesDB + the outbox and meta stores.
export class OfflinearDB extends Dexie {
  teams!: EntityTable<Team, "id">;
  states!: EntityTable<State, "id">;
  labels!: EntityTable<Label, "id">;
  members!: EntityTable<Member, "id">;
  issues!: EntityTable<Issue, "id">;
  comments!: EntityTable<Comment, "id">;
  outbox!: EntityTable<OutboxEntry, "opId">;
  meta!: EntityTable<Meta, "key">;
  drafts!: EntityTable<Draft, "id">;
  ghmap!: EntityTable<GhMap, "issueId">;

  constructor() {
    super("offlinear");
    this.version(1).stores({
      teams: "id, key",
      states: "id, position",
      labels: "id, name",
      members: "id, email",
      issues: "id, key, stateId, assigneeId, parentId, updatedAt, boardOrder",
      comments: "id, issueId, createdAt",
      outbox: "opId, status",
      meta: "key",
    });
    this.version(2).stores({ drafts: "id, updatedAt" });
    this.version(3).stores({ ghmap: "issueId, itemId" });
  }
}

export const db = new OfflinearDB();
