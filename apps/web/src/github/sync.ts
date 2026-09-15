import type { Issue } from "@offlinear/shared";
import { db } from "@/db/db";
import { createIssue } from "@/store/mutations";
import { DATABASE_ID, appwriteConfigured, tablesDB } from "@/sync/appwrite-config";
import { addDraftIssue, getProjectItems, type GhItem, type GhProject } from "./client";

const PROJECT_KEY = "github.project";

export async function getSelectedProject(): Promise<GhProject | null> {
  return ((await db.meta.get(PROJECT_KEY))?.value as GhProject | undefined) ?? null;
}

export async function setSelectedProject(p: GhProject | null): Promise<void> {
  await db.meta.put({ key: PROJECT_KEY, value: p });
  // Persist to Appwrite too so the cloud auto-syncer targets the chosen board.
  if (appwriteConfigured && tablesDB) {
    const now = new Date().toISOString();
    try {
      await tablesDB.upsertRow(DATABASE_ID, "settings", "app", {
        githubProjectId: p?.id ?? null,
        githubOwner: p?.owner ?? null,
        githubTitle: p?.title ?? null,
        rev: 1,
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      /* settings table may not exist yet; local choice still applies */
    }
  }
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
export async function pushIssues(
  projectId: string,
  issues: Issue[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  let done = 0;
  for (const issue of issues) {
    const itemId = await addDraftIssue(projectId, issue.title, issue.description);
    await db.ghmap.put({ issueId: issue.id, itemId, projectId });
    onProgress?.(++done, issues.length);
  }
}

/** Import selected GitHub items as new local issues and record the mapping. */
export async function importItems(
  projectId: string,
  items: GhItem[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  let done = 0;
  for (const item of items) {
    const id = await createIssue({ title: item.title });
    await db.ghmap.put({ issueId: id, itemId: item.itemId, projectId });
    onProgress?.(++done, items.length);
  }
}
