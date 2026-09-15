import type { Op } from "@offlinear/shared";
import type { PullResult, PushResult, SyncAdapter } from "./adapter";

/**
 * Single-device adapter. Acknowledges every op (the optimistic local write is
 * already authoritative here) so the outbox drains cleanly. It simulates a
 * little network latency so the "syncing → synced" transition is visible.
 *
 * There is no cross-device delivery in local mode — that arrives with the
 * AppwriteAdapter (MQTT/Realtime pull) in a later phase.
 */
export class LocalAdapter implements SyncAdapter {
  readonly name = "local";

  async push(op: Op): Promise<PushResult> {
    await delay(120);
    const rev = op.type === "create" ? 1 : op.baseRev + 1;
    return { ok: true, rev };
  }

  async pullSince(): Promise<PullResult> {
    return { rows: [], cursor: null };
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
