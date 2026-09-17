import * as React from "react";
import { ArrowLeft, Trash2, FileText, Github, Loader2, ExternalLink, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { download, reportToMarkdown, json } from "@/lib/export";
import { db } from "@/db/db";
import { useReport } from "@/hooks/useData";
import { openReportPage } from "@/store/route";
import { deleteReport, updateReport } from "@/store/mutations";
import { publishReport, syncReportToGist } from "@/github/gists";
import { NotificationBell } from "./Notifications";
import { RichEditor, type RichEditorHandle } from "./RichEditor";
import { AttachButton, IssuePicker, ReportPicker } from "./LinkPickers";

/** Full-page Notion-style report editor (route /report/:id). */
export function ReportView({ reportId }: { reportId: string }) {
  const report = useReport(reportId);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [publishing, setPublishing] = React.useState(false);
  const [gistUrl, setGistUrl] = React.useState<string | null>(null);
  const [pubError, setPubError] = React.useState<string | null>(null);
  const editorRef = React.useRef<RichEditorHandle>(null);
  const back = () => openReportPage(null);

  const publish = async () => {
    if (!report) return;
    setPublishing(true);
    setPubError(null);
    try {
      await updateReport(report.id, { title, body }); // flush latest before push
      const { result, url } = await publishReport(report.id);
      if (result === "conflict") setPubError("Gist changed remotely — resolve via the bell.");
      else setGistUrl(url ?? null);
    } catch (e) {
      setPubError(String((e as Error).message));
    } finally {
      setPublishing(false);
    }
  };

  // Auto-sync edits to the linked gist (debounced, conflict-aware).
  const lastSynced = React.useRef("");
  React.useEffect(() => {
    lastSynced.current = report?.body ?? "";
  }, [report?.id]);
  React.useEffect(() => {
    const r = report;
    if (!r?.gistId || body === lastSynced.current) return;
    const t = setTimeout(async () => {
      try {
        await updateReport(r.id, { title, body });
        await syncReportToGist(r.id);
        lastSynced.current = body;
      } catch (e) {
        console.error("[gist] auto-sync failed", e);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [title, body, report]);

  React.useEffect(() => {
    if (report) {
      setTitle(report.title);
      setBody(report.body);
    }
  }, [report?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autosave.
  React.useEffect(() => {
    if (!report) return;
    if (title === report.title && body === report.body) return;
    const t = setTimeout(() => updateReport(report.id, { title, body }), 500);
    return () => clearTimeout(t);
  }, [title, body, report]);

  const insertIssue = async (id: string) => {
    const issue = await db.issues.get(id);
    if (issue) editorRef.current?.insertLink(`#${issue.key} ${issue.title}`, `issue:${id}`);
  };
  const insertReport = (id: string, name: string) =>
    editorRef.current?.insertLink(name, `report:${id}`);

  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-subtle">
        <p className="text-[14px]">Report not found.</p>
        <button onClick={back} className="text-[13px] text-brand hover:text-brand-hover">
          Back to board
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-2.5">
        <button
          onClick={back}
          className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <FileText className="h-4 w-4 text-ink-tertiary" />
        <span className="text-[12px] text-ink-tertiary">Report</span>
        {(gistUrl || report.gistId) && (
          <a
            href={gistUrl ?? `https://gist.github.com/${report.gistId}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 text-[12px] text-ink-tertiary hover:text-ink"
            title="Open gist"
          >
            <ExternalLink className="h-3 w-3" /> gist
          </a>
        )}
        {pubError && <span className="text-[12px] text-danger">{pubError}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />
          <button
            onClick={publish}
            disabled={publishing}
            className="flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink"
            title="Publish to a private GitHub Gist"
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
            {report.gistId ? "Update gist" : "Publish"}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink" title="Export">
                <Download className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => download(`${report.title || "report"}.md`, reportToMarkdown(report), "text/markdown")}
              >
                <Download className="h-3.5 w-3.5" /> Markdown
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => download(`${report.title || "report"}.json`, json(report), "application/json")}
              >
                <Download className="h-3.5 w-3.5" /> JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => {
              void deleteReport(report.id);
              back();
            }}
            className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-danger"
            title="Delete report"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col overflow-y-auto px-8 py-6">
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={1}
          placeholder="Untitled"
          className="w-full resize-none bg-transparent text-[28px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-tertiary"
        />

        <div className="mt-3 flex items-center gap-1.5">
          <IssuePicker onPick={insertIssue} />
          <ReportPicker excludeId={report.id} onPick={insertReport} />
          <AttachButton onFiles={(f) => editorRef.current?.insertFiles(f)} />
        </div>

        <RichEditor ref={editorRef} resetKey={report.id} value={body} onChange={setBody} />
      </div>
    </div>
  );
}
