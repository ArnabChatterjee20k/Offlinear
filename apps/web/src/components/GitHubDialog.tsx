import * as React from "react";
import { Github, Loader2, ArrowUpRight, ArrowDownLeft, Terminal, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useUI } from "@/store/ui";
import { githubToken, loginWithGitHub, logout } from "@/auth";
import { listProjects, type GhProject } from "@/github/client";
import { bridgeHealth, setMode, BRIDGE_URL } from "@/github/config";
import {
  backfillDescriptions,
  computeDiff,
  getSelectedProject,
  importItems,
  pushIssues,
  saveGithubToken,
  setSelectedProject,
  type Diff,
} from "@/github/sync";

type Phase = "loading" | "connect" | "pick" | "sync";

export function GitHubDialog() {
  const open = useUI((s) => s.githubOpen);
  const setGithub = useUI((s) => s.setGithub);

  const [phase, setPhase] = React.useState<Phase>("loading");
  const [projects, setProjects] = React.useState<GhProject[]>([]);
  const [selected, setSelected] = React.useState<GhProject | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [diff, setDiff] = React.useState<Diff | null>(null);
  const [busy, setBusy] = React.useState<null | "import" | "export" | "diff" | "backfill">(null);
  const [progress, setProgress] = React.useState<string | null>(null);

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

  const refreshDiff = React.useCallback(async () => {
    const sel = await getSelectedProject();
    if (!sel) return;
    setBusy("diff");
    setError(null);
    try {
      setDiff(await computeDiff(sel.id));
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  }, []);

  // Load counts when the sync view opens.
  React.useEffect(() => {
    if (phase === "sync") void refreshDiff();
  }, [phase, refreshDiff]);

  const runExport = async () => {
    if (!selected || !diff) return;
    setBusy("export");
    setError(null);
    try {
      await pushIssues(selected.id, diff.onlyLocal, (d, t) => setProgress(`Exporting ${d}/${t}…`));
      setProgress(null);
      await refreshDiff();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  };

  const runBackfill = async () => {
    if (!selected) return;
    setBusy("backfill");
    setError(null);
    try {
      const n = await backfillDescriptions(selected.id, (d, t) =>
        setProgress(`Fetching descriptions ${d}/${t}…`)
      );
      setProgress(`Filled ${n} description${n === 1 ? "" : "s"}`);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!selected || !diff) return;
    setBusy("import");
    setError(null);
    try {
      await importItems(selected.id, diff.onlyGithub, (d, t) => setProgress(`Importing ${d}/${t}…`));
      setProgress(null);
      await refreshDiff();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setGithub(false)}>
      <DialogContent aria-describedby={undefined} className="max-w-[560px] p-0">
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
              className="ml-auto truncate text-[12px] text-ink-subtle hover:text-ink"
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
              <ConnectOption
                icon={<Github className="mt-0.5 h-4 w-4 text-ink" />}
                title="Continue with GitHub"
                desc="Browser OAuth with the project scope."
                onClick={connectOAuth}
              />
              <ConnectOption
                icon={<Terminal className="mt-0.5 h-4 w-4 text-ink" />}
                title="Continue with gh CLI (local)"
                desc="Uses your local gh auth via the bridge — no browser sign-in."
                onClick={connectCli}
              />
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
              <div className="mb-2 text-[12px] text-ink-subtle">Choose a project board:</div>
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
            <div className="space-y-4">
              <TokenField />

              <ActionCard
                icon={<ArrowDownLeft className="h-4 w-4 text-ink" />}
                title="Import from GitHub"
                desc="Bring board items in as issues, matching their Status column."
                count={diff?.onlyGithub.length}
                loading={busy === "diff"}
                running={busy === "import"}
                disabled={busy != null || (diff?.onlyGithub.length ?? 0) === 0}
                onRun={runImport}
              />

              <ActionCard
                icon={<ArrowUpRight className="h-4 w-4 text-ink" />}
                title="Export to GitHub"
                desc="Push your issues to the board as draft items with their status."
                count={diff?.onlyLocal.length}
                loading={busy === "diff"}
                running={busy === "export"}
                disabled={busy != null || (diff?.onlyLocal.length ?? 0) === 0}
                onRun={runExport}
              />

              <ActionCard
                icon={<FileText className="h-4 w-4 text-ink" />}
                title="Fetch descriptions"
                desc="Fill empty descriptions from matching GitHub cards."
                loading={false}
                running={busy === "backfill"}
                disabled={busy != null}
                onRun={runBackfill}
              />

              <div className="flex items-center justify-between text-[12px] text-ink-tertiary">
                <span>{progress ?? (diff ? `${diff.matched.length} already synced` : "")}</span>
                <button onClick={() => void refreshDiff()} className="hover:text-ink" disabled={busy != null}>
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConnectOption({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border border-hairline px-4 py-3 text-left hover:border-hairline-strong hover:bg-surface-1"
    >
      {icon}
      <div>
        <div className="text-[14px] text-ink">{title}</div>
        <div className="text-[12px] text-ink-tertiary">{desc}</div>
      </div>
    </button>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  count,
  loading,
  running,
  disabled,
  onRun,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  count?: number;
  loading: boolean;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline px-4 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-ink">{title}</div>
        <div className="text-[12px] text-ink-tertiary">{desc}</div>
      </div>
      <Button variant="primary" size="sm" disabled={disabled} onClick={onRun}>
        {running && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "…" : count != null ? `${title.split(" ")[0]} ${count}` : title.split(" ")[0]}
      </Button>
    </div>
  );
}

/** Optional GitHub token for the cloud auto-syncer (stored in Appwrite
 *  settings — the function uses it instead of the deploy-time env var). */
function TokenField() {
  const [token, setToken] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await saveGithubToken(token);
      setSaved(true);
      setToken("");
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="rounded-md border border-hairline">
      <summary className="cursor-pointer px-3 py-2 text-[12px] text-ink-subtle">
        Auto-sync token (server)
      </summary>
      <div className="space-y-1.5 px-3 pb-3">
        <p className="text-[11px] text-ink-tertiary">
          Paste a GitHub token (fine-grained PAT, Projects read/write). The cloud auto-syncer uses
          this instead of the env token. Stored in your project DB.
        </p>
        <div className="flex gap-1.5">
          <Input
            type="password"
            placeholder="ghp_… or github_pat_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Button variant="primary" size="sm" disabled={busy || !token.trim()} onClick={save}>
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
    </details>
  );
}
