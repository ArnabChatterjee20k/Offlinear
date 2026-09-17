import { db } from "@/db/db";
import { createReport, updateReport } from "@/store/mutations";
import { ghRest } from "./client";

interface GistFile {
  filename: string;
  content?: string;
}
interface Gist {
  id: string;
  description: string | null;
  html_url: string;
  files: Record<string, GistFile>;
}

const FILENAME = "report.md";

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

/** Publish a report to its linked private gist, creating one if needed. */
export async function publishReport(reportId: string): Promise<string> {
  const report = await db.reports.get(reportId);
  if (!report) throw new Error("Report not found");
  if (report.gistId) {
    const g = await updateGist(report.gistId, report.title, report.body);
    return g.html_url;
  }
  const g = await createGist(report.title, report.body);
  await updateReport(reportId, { gistId: g.id });
  return g.html_url;
}

/** Import the viewer's private gists as reports (skipping already-linked ones). */
export async function importGists(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const gists = await listGists();
  const linked = new Set((await db.reports.toArray()).map((r) => r.gistId).filter(Boolean));
  let imported = 0;
  let done = 0;
  for (const meta of gists) {
    if (!linked.has(meta.id)) {
      // The list endpoint truncates file content; fetch the full gist.
      const g = await getGist(meta.id);
      const file = Object.values(g.files)[0];
      const title = g.description?.trim() || file?.filename || "Imported gist";
      await createReport({ title, body: file?.content ?? "", gistId: g.id });
      imported++;
    }
    onProgress?.(++done, gists.length);
  }
  return imported;
}
