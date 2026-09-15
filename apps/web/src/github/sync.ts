import type { Issue } from "@offlinear/shared";
import { db } from "@/db/db";
import { createIssue, createState } from "@/store/mutations";
import { DATABASE_ID, appwriteConfigured, tablesDB } from "@/sync/appwrite-config";
import {
  addDraftIssue,
  getProjectItems,
  getStatusField,
  setItemStatus,
  type GhItem,
  type GhProject,
} from "./client";

const PROJECT_KEY = "github.project";

export async function getSelectedProject(): Promise<GhProject | null> {
  return ((await db.meta.get(PROJECT_KEY))?.value as GhProject | undefined) ?? null;
}

/** Merge-write the settings.app row (partial), creating it if missing. */
async function updateSettings(patch: Record<string, unknown>): Promise<void> {
  if (!appwriteConfigured || !tablesDB) return;
  const now = new Date().toISOString();
  try {
    await tablesDB.updateRow(DATABASE_ID, "settings", "app", { ...patch, updatedAt: now });
  } catch (e) {
    if ((e as { code?: number }).code === 404) {
      await tablesDB.upsertRow(DATABASE_ID, "settings", "app", {
        ...patch,
        rev: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
    /* else: settings unavailable; local choice still applies */
  }
}

export async function setSelectedProject(p: GhProject | null): Promise<void> {
  await db.meta.put({ key: PROJECT_KEY, value: p });
  // Persist to Appwrite so the cloud auto-syncer targets the chosen board.
  await updateSettings({
    githubProjectId: p?.id ?? null,
    githubOwner: p?.owner ?? null,
    githubTitle: p?.title ?? null,
  });
}

/** Store a GitHub token the cloud auto-syncer will use (instead of the env var). */
export async function saveGithubToken(token: string): Promise<void> {
  await updateSettings({ githubToken: token.trim() || null });
}

export interface Diff {
  matched: { issue: Issue; item: GhItem }[];
  onlyLocal: Issue[]; // candidates to push
  onlyGithub: GhItem[]; // candidates to import
}

const norm = (s: string) => s.trim().toLowerCase();

/** Compare local top-level issues to the project's items (by stored mapping,
 *  falling back to exact title match). */
export async function computeDiff(projectId: string): Promise<Diff> {
  const [issues, items, maps] = await Promise.all([
    db.issues.filter((i) => !i.parentId && !i.archivedAt).toArray(),
    getProjectItems(projectId),
    db.ghmap.toArray(),
  ]);

  const itemById = new Map(items.map((it) => [it.itemId, it]));
  const mapByIssue = new Map(maps.map((m) => [m.issueId, m]));
  const itemsByTitle = new Map(items.map((it) => [norm(it.title), it]));

  const matched: Diff["matched"] = [];
  const onlyLocal: Issue[] = [];
  const usedItems = new Set<string>();

  for (const issue of issues) {
    const mapped = mapByIssue.get(issue.id);
    const item =
      (mapped && itemById.get(mapped.itemId)) || itemsByTitle.get(norm(issue.title)) || null;
    if (item) {
      matched.push({ issue, item });
      usedItems.add(item.itemId);
    } else {
      onlyLocal.push(issue);
    }
  }

  const onlyGithub = items.filter((it) => !usedItems.has(it.itemId));
  return { matched, onlyLocal, onlyGithub };
}

/** Push selected local issues as draft items and record the mapping. */
const normName = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();

export async function pushIssues(
  projectId: string,
  issues: Issue[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  // Map each issue's state → the project's matching Status option.
  const states = await db.states.toArray();
  const stateName = new Map(states.map((s) => [s.id, s.name]));
  const statusField = await getStatusField(projectId);
  const optByName = new Map(
    (statusField?.options ?? []).map((o) => [normName(o.name), o.id])
  );

  let done = 0;
  for (const issue of issues) {
    const itemId = await addDraftIssue(projectId, issue.title, issue.description);
    if (statusField) {
      const optId = optByName.get(normName(stateName.get(issue.stateId) ?? ""));
      if (optId) await setItemStatus(projectId, itemId, statusField.fieldId, optId);
    }
    await db.ghmap.put({ issueId: issue.id, itemId, projectId });
    onProgress?.(++done, issues.length);
  }
}

/** Import selected GitHub items as new local issues, placing each in the state
 *  matching its GitHub Status — creating that column if it doesn't exist yet.
 *  Records the mapping. */
export async function importItems(
  projectId: string,
  items: GhItem[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const states = await db.states.toArray();
  const nameToId = new Map(states.map((s) => [normName(s.name), s.id]));

  const ensureState = async (status: string | null): Promise<string | undefined> => {
    if (!status) return undefined;
    const key = normName(status);
    const found = nameToId.get(key);
    if (found) return found;
    const id = await createState({ name: status });
    nameToId.set(key, id);
    return id;
  };

  let done = 0;
  for (const item of items) {
    const stateId = await ensureState(item.status);
    const id = await createIssue({ title: item.title, stateId });
    await db.ghmap.put({ issueId: id, itemId: item.itemId, projectId });
    onProgress?.(++done, items.length);
  }
}
