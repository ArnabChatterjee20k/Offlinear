import { Query, type Models } from "appwrite";
import type { EntityName, Op } from "@offlinear/shared";
import type { PullResult, PushResult, SyncAdapter } from "./adapter";
import { DATABASE_ID, account, client, databases } from "./appwrite-config";

const COLLECTIONS: EntityName[] = [
  "teams",
  "states",
  "labels",
  "members",
  "issues",
  "comments",
];

/** Strip Appwrite system ($-prefixed) fields and re-key $id → id. */
function toRow(doc: Models.Document): Record<string, unknown> {
  const row: Record<string, unknown> = { id: doc.$id };
  for (const [k, v] of Object.entries(doc)) {
    if (!k.startsWith("$")) row[k] = v;
  }
  return row;
}

/** Remove id and undefined before writing document data. */
function clean(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Appwrite TablesDB adapter — the source of truth. push() writes documents;
 * pullSince() pages changed rows by `updatedAt`; subscribe() streams Realtime
 * events. The client mirror in Dexie stays offline-capable; this reconciles it.
 */
export class AppwriteAdapter implements SyncAdapter {
  readonly name = "appwrite";
  private session?: Promise<void>;

  private ensureSession(): Promise<void> {
    if (!this.session) {
      this.session = (async () => {
        try {
          await account!.get();
        } catch {
          await account!.createAnonymousSession();
        }
      })();
    }
    return this.session;
  }

  async push(op: Op): Promise<PushResult> {
    await this.ensureSession();
    const col = op.entity;
    const data = clean(op.patch as Record<string, unknown>);
    try {
      if (op.type === "create") {
        await databases!.createDocument(DATABASE_ID, col, op.entityId, data);
      } else if (op.type === "update") {
        await databases!.updateDocument(DATABASE_ID, col, op.entityId, data);
      } else {
        await databases!.deleteDocument(DATABASE_ID, col, op.entityId);
      }
      return { ok: true, rev: op.type === "create" ? 1 : op.baseRev + 1 };
    } catch (e) {
      const code = (e as { code?: number }).code;
      // Create raced an existing doc, or update targets a not-yet-created doc.
      if (op.type === "create" && code === 409) {
        await databases!.updateDocument(DATABASE_ID, col, op.entityId, data);
        return { ok: true, rev: op.baseRev + 1 };
      }
      if (op.type === "delete" && code === 404) return { ok: true, rev: op.baseRev };
      throw e;
    }
  }

  async pullSince(cursor: string | null): Promise<PullResult> {
    await this.ensureSession();
    const rows: PullResult["rows"] = [];
    let maxUpdated = cursor ?? "";

    for (const col of COLLECTIONS) {
      let after = cursor;
      // Page ascending by updatedAt until a short page.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const queries = [Query.orderAsc("updatedAt"), Query.limit(100)];
        if (after) queries.push(Query.greaterThan("updatedAt", after));
        const res = await databases!.listDocuments(DATABASE_ID, col, queries);
        for (const doc of res.documents) {
          rows.push({ entity: col, row: toRow(doc) });
          const u = (doc as unknown as { updatedAt: string }).updatedAt;
          if (u > maxUpdated) maxUpdated = u;
          if (u > (after ?? "")) after = u;
        }
        if (res.documents.length < 100) break;
      }
    }
    return { rows, cursor: maxUpdated || cursor };
  }

  subscribe(onChange: (r: PullResult) => void): () => void {
    const channels = COLLECTIONS.map(
      (c) => `databases.${DATABASE_ID}.collections.${c}.documents`
    );
    return client!.subscribe<Models.Document>(channels, (res) => {
      const entity = COLLECTIONS.find((c) =>
        res.channels.some((ch) => ch.endsWith(`collections.${c}.documents`))
      );
      if (!entity) return;
      const deleted = res.events.some((e) => e.endsWith(".delete"));
      const row = toRow(res.payload);
      onChange({
        rows: [{ entity, row, ...(deleted ? { deleted: true } : {}) }],
        cursor: (res.payload as unknown as { updatedAt?: string }).updatedAt ?? null,
      });
    });
  }
}
