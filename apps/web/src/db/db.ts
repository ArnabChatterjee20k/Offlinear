import Dexie, { type EntityTable } from "dexie";
import type {
  Comment,
  Issue,
  Label,
  Member,
  Op,
  State,
  Team,
} from "@offlinear/shared";

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
  }
}

export const db = new OfflinearDB();
