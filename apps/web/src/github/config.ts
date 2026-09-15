import { db } from "@/db/db";

export type GhMode = "oauth" | "cli";

/** Base URL of the gh-CLI bridge API. Defaults to the same origin (the Bun
 *  fullstack server serves it at /api/gh); override with VITE_GH_BRIDGE_URL. */
export const BRIDGE_URL =
  (import.meta.env.VITE_GH_BRIDGE_URL as string | undefined) ?? "/api/gh";

const MODE_KEY = "github.mode";

export async function getMode(): Promise<GhMode> {
  return ((await db.meta.get(MODE_KEY))?.value as GhMode | undefined) ?? "oauth";
}
export async function setMode(m: GhMode): Promise<void> {
  await db.meta.put({ key: MODE_KEY, value: m });
}

export interface BridgeHealth {
  ok: boolean;
  user?: string;
  error?: string;
}

export async function bridgeHealth(): Promise<BridgeHealth> {
  try {
    const r = await fetch(`${BRIDGE_URL}/health`);
    return (await r.json()) as BridgeHealth;
  } catch {
    return { ok: false, error: `gh-bridge not reachable at ${BRIDGE_URL}` };
  }
}
