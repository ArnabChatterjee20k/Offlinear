import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Hash, AtSign, Eye, Pencil, Trash2, FileText, Github, Loader2, ExternalLink } from "lucide-react";
import { db } from "@/db/db";
import { useReport, useReports } from "@/hooks/useData";
import { openReportPage } from "@/store/route";
import { deleteReport, updateReport } from "@/store/mutations";
import { publishReport, syncReportToGist } from "@/github/gists";
import { NotificationBell } from "./Notifications";
import { Markdown } from "./Markdown";
import { Input } from "./ui/input";

/** Full-page Notion-style report editor (route /report/:id). */
export function ReportView({ reportId }: { reportId: string }) {
  const report = useReport(reportId);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const [publishing, setPublishing] = React.useState(false);
  const [gistUrl, setGistUrl] = React.useState<string | null>(null);
  const [pubError, setPubError] = React.useState<string | null>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
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

  const insertAtCaret = (text: string) => {
    const el = bodyRef.current;
    const at = el ? el.selectionStart : body.length;
    const next = body.slice(0, at) + text + body.slice(at);
    setBody(next);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = at + text.length;
      }
    });
  };

  const insertIssue = async (id: string) => {
    const issue = await db.issues.get(id);
    if (issue) insertAtCaret(`[#${issue.key} ${issue.title}](issue:${id})`);
  };
  const insertReport = (id: string, name: string) => insertAtCaret(`[${name}](report:${id})`);

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
          <button
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            className="flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:text-ink"
          >
            {mode === "edit" ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {mode === "edit" ? "Preview" : "Edit"}
          </button>
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

        {mode === "edit" && (
          <div className="mt-3 flex items-center gap-1.5">
            <IssuePicker onPick={insertIssue} />
            <ReportPicker excludeId={report.id} onPick={insertReport} />
            <span className="text-[11px] text-ink-tertiary">Markdown supported</span>
          </div>
        )}

        {mode === "edit" ? (
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write here…  Use # to link an issue, @ to link a report."
            className="mt-3 min-h-[50vh] w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-ink-muted outline-none placeholder:text-ink-tertiary"
          />
        ) : (
          <div className="mt-4">
            <Markdown className="text-[15px]">{body || "_Empty report._"}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Cross-link pickers -----------------------------------------------------

function IssuePicker({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const results =
    useLiveQuery(async () => {
      const term = q.trim().toLowerCase();
      const all = await db.issues.limit(2000).toArray();
      return all
        .filter((i) => !term || i.key.toLowerCase().includes(term) || i.title.toLowerCase().includes(term))
        .slice(0, 8);
    }, [q]) ?? [];
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink">
          <Hash className="h-3.5 w-3.5" /> Link issue
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[340px] rounded-lg border border-hairline-strong bg-surface-3 p-1.5 shadow-2xl">
          <Input autoFocus placeholder="Search issues…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-1 bg-surface-2" />
          <div className="max-h-[260px] overflow-y-auto">
            {results.map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  onPick(i.id);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-4"
              >
                <span className="font-mono text-[11px] text-ink-tertiary">{i.key}</span>
                <span className="truncate text-[13px] text-ink-muted">{i.title}</span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ReportPicker({ excludeId, onPick }: { excludeId: string; onPick: (id: string, name: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const reports = useReports();
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink">
          <AtSign className="h-3.5 w-3.5" /> Link report
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[300px] rounded-lg border border-hairline-strong bg-surface-3 p-1.5 shadow-2xl">
          <div className="max-h-[260px] overflow-y-auto">
            {reports
              .filter((r) => r.id !== excludeId)
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onPick(r.id, r.title);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-4"
                >
                  <FileText className="h-3.5 w-3.5 text-ink-tertiary" />
                  <span className="truncate text-[13px] text-ink-muted">{r.title}</span>
                </button>
              ))}
            {reports.filter((r) => r.id !== excludeId).length === 0 && (
              <div className="px-2 py-3 text-center text-[13px] text-ink-tertiary">No other reports</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
