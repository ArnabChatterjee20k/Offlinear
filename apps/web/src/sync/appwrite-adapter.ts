import { Query, type Models } from "appwrite";
import type { EntityName, Op } from "@offlinear/shared";
import type { PullResult, PushResult, SyncAdapter } from "./adapter";
import { DATABASE_ID, account, client, tablesDB } from "./appwrite-config";

const TABLES: EntityName[] = ["teams", "states", "labels", "members", "issues", "comments"];

/** Strip Appwrite system ($-prefixed) fields and re-key $id → id. */
function toRow(row: Models.Row): Record<string, unknown> {
  const out: Record<string, unknown> = { id: row.$id };
  for (const [k, v] of Object.entries(row)) {
    if (!k.startsWith("$")) out[k] = v;
  }
  return out;
}

/** Remove id and undefined before writing row data. */
function clean(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Appwrite TablesDB adapter — the source of truth. push() writes rows;
 * pullSince() pages changed rows by `updatedAt`; subscribe() streams Realtime
 * row events. The Dexie mirror stays offline-capable; this reconciles it.
 */
export class AppwriteAdapter implements SyncAdapter {
  readonly name = "appwrite";
  private session?: Promise<void>;

  private ensureSession(): Promise<void> {
    if (!this.session) {
      this.session = account!.get().then(
        () => undefined,
        () => undefined // no session yet; writes will 401 until login
      );
    }
    return this.session;
  }

  async push(op: Op): Promise<PushResult> {
    await this.ensureSession();
    const table = op.entity;
    const data = clean(op.patch as Record<string, unknown>);
    try {
      if (op.type === "create") {
        await tablesDB!.upsertRow(DATABASE_ID, table, op.entityId, data);
      } else if (op.type === "update") {
        await tablesDB!.updateRow(DATABASE_ID, table, op.entityId, data);
      } else {
        await tablesDB!.deleteRow(DATABASE_ID, table, op.entityId);
      }
      return { ok: true, rev: op.type === "create" ? 1 : op.baseRev + 1 };
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (op.type === "update" && code === 404) {
        return { ok: false, conflict: "missing" };
      }
      if (op.type === "delete" && code === 404) return { ok: true, rev: op.baseRev };
      throw e;
    }
  }

  async pullSince(cursor: string | null): Promise<PullResult> {
    await this.ensureSession();
    const rows: PullResult["rows"] = [];
    let maxUpdated = cursor ?? "";

    for (const table of TABLES) {
      let after = cursor;
      // Page ascending by updatedAt until a short page.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const queries = [Query.orderAsc("updatedAt"), Query.limit(100)];
        if (after) queries.push(Query.greaterThan("updatedAt", after));
        const res = await tablesDB!.listRows(DATABASE_ID, table, queries);
        for (const row of res.rows) {
          rows.push({ entity: table, row: toRow(row) });
          const u = (row as unknown as { updatedAt: string }).updatedAt;
          if (u > maxUpdated) maxUpdated = u;
          if (u > (after ?? "")) after = u;
        }
        if (res.rows.length < 100) break;
      }
    }
    return { rows, cursor: maxUpdated || cursor };
  }

  subscribe(onChange: (r: PullResult) => void): () => void {
    const channels = TABLES.map((t) => `databases.${DATABASE_ID}.tables.${t}.rows`);
    return client!.subscribe<Models.Row>(channels, (res) => {
      const entity = TABLES.find((t) =>
        res.channels.some((ch) => ch.endsWith(`tables.${t}.rows`))
      );
      if (!entity) return;
      const deleted = res.events.some((e) => e.endsWith(".delete"));
      onChange({
        rows: [{ entity, row: toRow(res.payload), ...(deleted ? { deleted: true } : {}) }],
        cursor: (res.payload as unknown as { updatedAt?: string }).updatedAt ?? null,
      });
    });
  }
}
