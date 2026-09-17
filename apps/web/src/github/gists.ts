import { db } from "@/db/db";
import { createReport, updateReport } from "@/store/mutations";
import { useNotifications } from "@/store/notifications";
import { ghRest } from "./client";

interface GistFile {
  filename: string;
  content?: string;
}
interface Gist {
  id: string;
  description: string | null;
  html_url: string;
  updated_at: string;
  files: Record<string, GistFile>;
}

const FILENAME = "report.md";
const firstContent = (g: Gist) => Object.values(g.files)[0]?.content ?? "";

export async function createGist(title: string, content: string): Promise<Gist> {
  return ghRest<Gist>("POST", "/gists", {
    description: title,
    public: false,
    files: { [FILENAME]: { content: content || " " } },
  });
}
export async function updateGist(id: string, title: string, content: string): Promise<Gist> {
  return ghRest<Gist>("PATCH", `/gists/${id}`, {
    description: title,
    files: { [FILENAME]: { content: content || " " } },
  });
}
export const getGist = (id: string) => ghRest<Gist>("GET", `/gists/${id}`);
export const listGists = () => ghRest<Gist[]>("GET", "/gists?per_page=100");

export type SyncResult = "synced" | "conflict" | "nolink" | "created";

/**
 * Push a report to its gist, unless the gist was edited remotely since our last
 * sync (and differs) — then raise a conflict notification instead of clobbering
 * it. `force` overrides the conflict check (used by "keep mine").
 */
export async function syncReportToGist(reportId: string, force = false): Promise<SyncResult> {
  const report = await db.reports.get(reportId);
  if (!report?.gistId) return "nolink";

  if (!force) {
    const meta = await db.gistmeta.get(reportId);
    const remote = await getGist(report.gistId);
    const remoteBody = firstContent(remote);
    if (meta && remote.updated_at !== meta.remoteUpdatedAt && remoteBody !== report.body) {
      useNotifications.getState().add({
        kind: "gist-conflict",
        title: "Gist changed remotely",
        message: `“${report.title}” was edited on GitHub since your last sync.`,
        conflict: {
          reportId,
          gistId: report.gistId,
          localBody: report.body,
          remoteBody,
          remoteUpdatedAt: remote.updated_at,
        },
      });
      return "conflict";
    }
  }

  const updated = await updateGist(report.gistId, report.title, report.body);
  await db.gistmeta.put({ reportId, remoteUpdatedAt: updated.updated_at });
  return "synced";
}

/** Publish: create the gist if unlinked, else push (conflict-aware). */
export async function publishReport(reportId: string): Promise<{ result: SyncResult; url?: string }> {
  const report = await db.reports.get(reportId);
  if (!report) throw new Error("Report not found");
  if (!report.gistId) {
    const g = await createGist(report.title, report.body);
    await updateReport(reportId, { gistId: g.id });
    await db.gistmeta.put({ reportId, remoteUpdatedAt: g.updated_at });
    return { result: "created", url: g.html_url };
  }
  const result = await syncReportToGist(reportId);
  return { result, url: `https://gist.github.com/${report.gistId}` };
}

/** Adopt the remote gist content into the report and clear the conflict. */
export async function resolveKeepRemote(reportId: string): Promise<void> {
  const report = await db.reports.get(reportId);
  if (!report?.gistId) return;
  const remote = await getGist(report.gistId);
  await updateReport(reportId, { body: firstContent(remote) });
  await db.gistmeta.put({ reportId, remoteUpdatedAt: remote.updated_at });
}

/** Save a merged body to the report, then force-push it to the gist. */
export async function resolveWithMerge(reportId: string, body: string): Promise<void> {
  await updateReport(reportId, { body });
  await syncReportToGist(reportId, true);
}

export async function importGists(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const gists = await listGists();
  const linked = new Set((await db.reports.toArray()).map((r) => r.gistId).filter(Boolean));
  let imported = 0;
  let done = 0;
  for (const meta of gists) {
    if (!linked.has(meta.id)) {
      const g = await getGist(meta.id);
      const file = Object.values(g.files)[0];
      const title = g.description?.trim() || file?.filename || "Imported gist";
      const id = await createReport({ title, body: file?.content ?? "", gistId: g.id });
      await db.gistmeta.put({ reportId: id, remoteUpdatedAt: g.updated_at });
      imported++;
    }
    onProgress?.(++done, gists.length);
  }
  return imported;
}
