import type { Issue, Report } from "@offlinear/shared";
import { PRIORITY_LABELS } from "@offlinear/shared";

/** Trigger a client-side file download. */
export function download(name: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function issueToMarkdown(i: Issue): string {
  return `# ${i.key} — ${i.title}\n\n- Priority: ${PRIORITY_LABELS[i.priority]}\n\n${i.description || "_No description._"}\n`;
}

export function reportToMarkdown(r: Report): string {
  return `# ${r.title}\n\n${r.body || ""}\n`;
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export interface IssueMaps {
  stateName: Map<string, string>;
  memberName: Map<string, string>;
}

export function issuesToCsv(issues: Issue[], maps: IssueMaps): string {
  const head = ["Key", "Title", "Status", "Priority", "Assignee", "Created"];
  const rows = issues.map((i) =>
    [
      i.key,
      i.title,
      maps.stateName.get(i.stateId) ?? "",
      PRIORITY_LABELS[i.priority],
      i.assigneeId ? maps.memberName.get(i.assigneeId) ?? "" : "",
      i.createdAt,
    ]
      .map(csvCell)
      .join(",")
  );
  return [head.map(csvCell).join(","), ...rows].join("\n");
}

export function issuesToMarkdown(issues: Issue[], maps: IssueMaps): string {
  return issues
    .map(
      (i) =>
        `## ${i.key} ${i.title}\n\n- Status: ${maps.stateName.get(i.stateId) ?? ""}\n- Priority: ${PRIORITY_LABELS[i.priority]}\n\n${i.description || ""}`
    )
    .join("\n\n---\n\n");
}

export const json = (data: unknown) => JSON.stringify(data, null, 2);
