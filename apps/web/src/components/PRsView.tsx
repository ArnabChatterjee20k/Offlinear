import * as React from "react";
import {
  GitPullRequest,
  GitPullRequestDraft,
  RefreshCw,
  Loader2,
  ExternalLink,
  MessageSquare,
  Building2,
  User,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listPullRequests, type GhPull } from "@/github/client";
import { Badge } from "./ui/primitives";

type GroupBy = "repo" | "org" | "none";

/** Relative "time ago" for PR updated timestamps. */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function reviewBadge(decision: GhPull["reviewDecision"]) {
  if (decision === "APPROVED")
    return (
      <Badge color="var(--success)">
        <Check className="h-2.5 w-2.5" /> Approved
      </Badge>
    );
  if (decision === "CHANGES_REQUESTED")
    return (
      <Badge color="var(--danger)">
        <X className="h-2.5 w-2.5" /> Changes
      </Badge>
    );
  if (decision === "REVIEW_REQUIRED") return <Badge>Review needed</Badge>;
  return null;
}

function PRRow({ pr, showRepo }: { pr: GhPull; showRepo: boolean }) {
  const Icon = pr.isDraft ? GitPullRequestDraft : GitPullRequest;
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-1"
    >
      <Icon className={cn("h-4 w-4 shrink-0", pr.isDraft ? "text-ink-tertiary" : "text-success")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-ink group-hover:text-white">{pr.title}</span>
          {reviewBadge(pr.reviewDecision)}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-tertiary">
          {showRepo && <span className="truncate">{pr.repo}</span>}
          <span>#{pr.number}</span>
          <span>updated {ago(pr.updatedAt)}</span>
          {pr.comments > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" /> {pr.comments}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-tertiary opacity-0 group-hover:opacity-100" />
    </a>
  );
}

export function PRsView() {
  const [prs, setPrs] = React.useState<GhPull[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [groupBy, setGroupBy] = React.useState<GroupBy>("repo");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrs(await listPullRequests());
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const groups = React.useMemo(() => {
    const list = prs ?? [];
    if (groupBy === "none") return [{ key: "", type: "", prs: list }];
    const map = new Map<string, GhPull[]>();
    const typeOf = new Map<string, string>();
    for (const pr of list) {
      const key = groupBy === "org" ? pr.owner : pr.repo;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pr);
      typeOf.set(key, pr.ownerType);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([key, prs]) => ({ key, type: typeOf.get(key) ?? "", prs }));
  }, [prs, groupBy]);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-2.5">
        <GitPullRequest className="h-4 w-4 text-ink-tertiary" />
        <span className="text-[13px] font-medium text-ink">PRs</span>
        {prs && <span className="text-[12px] text-ink-tertiary">{prs.length} open</span>}
        {error && <span className="ml-2 truncate text-[12px] text-danger">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <GroupToggle value={groupBy} onChange={setGroupBy} />
          <button
            onClick={() => void load()}
            disabled={loading}
            title="Refresh"
            className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[900px] flex-1 overflow-y-auto px-6 py-5">
        {loading && !prs ? (
          <div className="flex h-full items-center justify-center gap-2 text-[13px] text-ink-subtle">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your open pull requests…
          </div>
        ) : error && !prs ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-subtle">
            <p className="max-w-md text-center text-[13px]">{error}</p>
            <button onClick={() => void load()} className="text-[13px] text-brand hover:text-brand-hover">
              Try again
            </button>
          </div>
        ) : prs && prs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
            <GitPullRequest className="h-8 w-8 text-ink-tertiary" />
            <p className="text-[14px]">No open pull requests.</p>
            <p className="text-[12px] text-ink-tertiary">PRs you author across your repos and orgs show up here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key || "all"}>
                {groupBy !== "none" && (
                  <div className="mb-1 flex items-center gap-2 px-3">
                    {g.type === "Organization" ? (
                      <Building2 className="h-3.5 w-3.5 text-ink-tertiary" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-ink-tertiary" />
                    )}
                    <span className="text-[12px] font-medium text-ink-muted">{g.key}</span>
                    <span className="text-[11px] text-ink-tertiary">{g.prs.length}</span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {g.prs.map((pr) => (
                    <PRRow key={pr.id} pr={pr} showRepo={groupBy !== "repo"} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupToggle({ value, onChange }: { value: GroupBy; onChange: (g: GroupBy) => void }) {
  const opts: { key: GroupBy; label: string }[] = [
    { key: "repo", label: "Repo" },
    { key: "org", label: "Org" },
    { key: "none", label: "Flat" },
  ];
  return (
    <div className="flex items-center rounded-md border border-hairline p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded px-2 py-0.5 text-[12px] transition-colors",
            value === o.key ? "bg-surface-2 text-ink" : "text-ink-subtle hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
