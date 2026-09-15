import * as React from "react";
import { Github, Loader2, ArrowUpRight, ArrowDownLeft, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { Terminal } from "lucide-react";
import { githubToken, loginWithGitHub, logout } from "@/auth";
import { listProjects, type GhItem, type GhProject } from "@/github/client";
import { bridgeHealth, setMode, BRIDGE_URL } from "@/github/config";
import {
  computeDiff,
  getSelectedProject,
  importItems,
  pushIssues,
  setSelectedProject,
  type Diff,
} from "@/github/sync";
import type { Issue } from "@offlinear/shared";

type Phase = "loading" | "connect" | "pick" | "sync";

export function GitHubDialog() {
  const open = useUI((s) => s.githubOpen);
  const setGithub = useUI((s) => s.setGithub);

  const [phase, setPhase] = React.useState<Phase>("loading");
  const [projects, setProjects] = React.useState<GhProject[]>([]);
  const [selected, setSelected] = React.useState<GhProject | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [diff, setDiff] = React.useState<Diff | null>(null);
  const [pushSel, setPushSel] = React.useState<Set<string>>(new Set());
  const [importSel, setImportSel] = React.useState<Set<string>>(new Set());
  const [progress, setProgress] = React.useState<string | null>(null);

  // Initialise when opened: go straight to sync if a board is chosen, else the
  // connection chooser (OAuth vs gh CLI).
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setDiff(null);
    (async () => {
      const sel = await getSelectedProject();
      if (sel) {
        setSelected(sel);
        setPhase("sync");
      } else {
        setPhase("connect");
      }
    })();
  }, [open]);

  const loadProjects = async () => {
    setPhase("loading");
    setError(null);
    try {
      setProjects(await listProjects());
      setPhase("pick");
    } catch (e) {
      setError(String((e as Error).message));
      setPhase("connect");
    }
  };

  const connectOAuth = async () => {
    await setMode("oauth");
    const token = await githubToken();
    if (!token) {
      await logout();
      loginWithGitHub();
      return;
    }
    await loadProjects();
  };

  const connectCli = async () => {
    await setMode("cli");
    setPhase("loading");
    setError(null);
    const health = await bridgeHealth();
    if (!health.ok) {
      setError(health.error ?? "gh-bridge unavailable");
      setPhase("connect");
      return;
    }
    await loadProjects();
  };

  const choose = async (p: GhProject) => {
    await setSelectedProject(p);
    setSelected(p);
    setPhase("sync");
  };

  const runDiff = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const d = await computeDiff(selected.id);
      setDiff(d);
      setPushSel(new Set(d.onlyLocal.map((i) => i.id)));
      setImportSel(new Set(d.onlyGithub.map((i) => i.itemId)));
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!selected || !diff) return;
    setBusy(true);
    setError(null);
    try {
      const toPush = diff.onlyLocal.filter((i) => pushSel.has(i.id));
      const toImport = diff.onlyGithub.filter((i) => importSel.has(i.itemId));
      if (toPush.length) {
        await pushIssues(selected.id, toPush, (d, t) => setProgress(`Pushing ${d}/${t}…`));
      }
      if (toImport.length) {
        await importItems(selected.id, toImport, (d, t) => setProgress(`Importing ${d}/${t}…`));
      }
      setProgress(null);
      await runDiff(); // refresh
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setGithub(false)}>
      <DialogContent aria-describedby={undefined} className="max-w-[620px] p-0">
        <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
          <Github className="h-4 w-4 text-ink" />
          <DialogTitle className="text-[15px] font-medium text-ink">GitHub sync</DialogTitle>
          {selected && (
            <button
              onClick={() => {
                setSelected(null);
                setSelectedProject(null);
                setDiff(null);
                void loadProjects();
              }}
              className="ml-auto text-[12px] text-ink-subtle hover:text-ink"
            >
              {selected.owner}/{selected.title} · change
            </button>
          )}
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-5">
          {error && (
            <div className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {error}
            </div>
          )}

          {phase === "loading" && (
            <div className="flex items-center gap-2 py-8 text-[13px] text-ink-subtle">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {phase === "connect" && (
            <div className="space-y-3 py-2">
              <button
                onClick={connectOAuth}
                className="flex w-full items-start gap-3 rounded-lg border border-hairline px-4 py-3 text-left hover:border-hairline-strong hover:bg-surface-1"
              >
                <Github className="mt-0.5 h-4 w-4 text-ink" />
                <div>
                  <div className="text-[14px] text-ink">Continue with GitHub</div>
                  <div className="text-[12px] text-ink-tertiary">
                    Browser OAuth with the <code className="text-ink-subtle">project</code> scope.
                  </div>
                </div>
              </button>

              <button
                onClick={connectCli}
                className="flex w-full items-start gap-3 rounded-lg border border-hairline px-4 py-3 text-left hover:border-hairline-strong hover:bg-surface-1"
              >
                <Terminal className="mt-0.5 h-4 w-4 text-ink" />
                <div>
                  <div className="text-[14px] text-ink">Continue with gh CLI (local)</div>
                  <div className="text-[12px] text-ink-tertiary">
                    Uses your local <code className="text-ink-subtle">gh</code> auth via the bridge —
                    no browser sign-in.
                  </div>
                </div>
              </button>

              {error && (
                <div className="rounded-md border border-hairline bg-surface-1 px-3 py-2 text-[12px] text-ink-subtle">
                  Start the server, then retry:
                  <pre className="mt-1 overflow-x-auto rounded bg-surface-3 px-2 py-1 font-mono text-[11px] text-ink">
                    pnpm serve
                  </pre>
                  <span className="text-ink-tertiary">
                    Requires <code>bun</code> and a signed-in <code>gh</code> (or GH_TOKEN). API at{" "}
                    <code>{BRIDGE_URL}</code>.
                  </span>
                </div>
              )}
            </div>
          )}

          {phase === "pick" && (
            <div>
              <div className="mb-2 text-[12px] text-ink-subtle">Choose a project board to sync with:</div>
              <div className="space-y-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => choose(p)}
                    className="flex w-full items-center gap-2 rounded-md border border-hairline px-3 py-2 text-left hover:border-hairline-strong hover:bg-surface-1"
                  >
                    <span className="text-[13px] text-ink">{p.title}</span>
                    <span className="text-[11px] text-ink-tertiary">
                      {p.owner} · #{p.number}
                    </span>
                  </button>
                ))}
                {projects.length === 0 && (
                  <div className="py-6 text-center text-[13px] text-ink-tertiary">
                    No Projects v2 boards found on your account or orgs.
                  </div>
                )}
              </div>
            </div>
          )}

          {phase === "sync" && (
            <SyncView
              diff={diff}
              busy={busy}
              progress={progress}
              pushSel={pushSel}
              importSel={importSel}
              onRunDiff={runDiff}
              onTogglePush={(id) => setPushSel((s) => toggle(s, id))}
              onToggleImport={(id) => setImportSel((s) => toggle(s, id))}
              onApply={apply}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}

function SyncView({
  diff,
  busy,
  progress,
  pushSel,
  importSel,
  onRunDiff,
  onTogglePush,
  onToggleImport,
  onApply,
}: {
  diff: Diff | null;
  busy: boolean;
  progress: string | null;
  pushSel: Set<string>;
  importSel: Set<string>;
  onRunDiff: () => void;
  onTogglePush: (id: string) => void;
  onToggleImport: (id: string) => void;
  onApply: () => void;
}) {
  if (!diff) {
    return (
      <div className="py-4 text-center">
        <p className="text-[13px] text-ink-muted">
          Compare this board with your issues, then choose what to push and import.
        </p>
        <Button variant="primary" className="mt-4" disabled={busy} onClick={onRunDiff}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Compare
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-[12px] text-ink-tertiary">
        {diff.matched.length} already synced · {diff.onlyLocal.length} local-only ·{" "}
        {diff.onlyGithub.length} GitHub-only
      </div>

      <Section
        icon={<ArrowUpRight className="h-3.5 w-3.5" />}
        title="Only in Offlinear → push to GitHub"
        empty="Nothing to push"
        rows={diff.onlyLocal.map((i: Issue) => ({
          id: i.id,
          title: i.title,
          meta: i.key,
          checked: pushSel.has(i.id),
          onToggle: () => onTogglePush(i.id),
        }))}
      />
      <Section
        icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
        title="Only on GitHub → import to Offlinear"
        empty="Nothing to import"
        rows={diff.onlyGithub.map((it: GhItem) => ({
          id: it.itemId,
          title: it.title,
          meta: it.status ?? "",
          checked: importSel.has(it.itemId),
          onToggle: () => onToggleImport(it.itemId),
        }))}
      />

      <div className="flex items-center justify-between border-t border-hairline pt-3">
        <span className="text-[12px] text-ink-tertiary">{progress ?? ""}</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={onRunDiff}>
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || (pushSel.size === 0 && importSel.size === 0)}
            onClick={onApply}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply ({pushSel.size + importSel.size})
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  empty,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  rows: { id: string; title: string; meta: string; checked: boolean; onToggle: () => void }[];
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-subtle">
        {icon}
        {title}
        <span className="text-ink-tertiary">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-hairline px-3 py-2 text-[12px] text-ink-tertiary">
          {empty}
        </div>
      ) : (
        <div className="max-h-[180px] space-y-0.5 overflow-y-auto rounded-md border border-hairline p-1">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={r.onToggle}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-1"
            >
              <span
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded border",
                  r.checked ? "border-brand bg-brand text-white" : "border-hairline-strong"
                )}
              >
                {r.checked && <Check className="h-3 w-3" />}
              </span>
              {r.meta && <span className="font-mono text-[11px] text-ink-tertiary">{r.meta}</span>}
              <span className="truncate text-[13px] text-ink-muted">{r.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
