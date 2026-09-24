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
  Copy,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CheckSquare,
  Search,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listPullRequests, type GhPull } from "@/github/client";
import { Badge } from "./ui/primitives";

type GroupBy = "repo" | "org" | "date" | "none";

const DATE_BUCKETS = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"] as const;

/** Which relative bucket an ISO timestamp falls into (by calendar day). */
function dateBucket(iso: string): (typeof DATE_BUCKETS)[number] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Older";
}

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

function PRRow({
  pr,
  showRepo,
  selected,
  onClick,
}: {
  pr: GhPull;
  showRepo: boolean;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const Icon = selected ? CheckCircle2 : pr.isDraft ? GitPullRequestDraft : GitPullRequest;
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2",
        selected ? "bg-surface-2 ring-1 ring-inset ring-brand/40" : "hover:bg-surface-1"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          selected ? "text-brand" : pr.isDraft ? "text-ink-tertiary" : "text-success"
        )}
      />
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
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(e) => e.stopPropagation()}
        title="Open on GitHub"
        className="shrink-0 rounded p-0.5 text-ink-tertiary opacity-0 hover:text-ink group-hover:opacity-100"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

/** Markdown links for the given PRs: [owner/repo #num](url), one per line. */
function toMarkdown(prs: GhPull[]): string {
  return prs.map((p) => `[${p.repo} #${p.number}](${p.url})`).join("\n");
}

/** Loose fuzzy match: substring, else in-order subsequence of the query chars. */
function fuzzy(query: string, text: string): boolean {
  const raw = query.toLowerCase().trim();
  if (!raw) return true;
  const t = text.toLowerCase();
  if (t.includes(raw)) return true;
  const q = raw.replace(/\s+/g, "");
  let i = 0;
  for (let j = 0; j < t.length && i < q.length; j++) if (t[j] === q[i]) i++;
  return i === q.length;
}

export function PRsView() {
  const [prs, setPrs] = React.useState<GhPull[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [groupBy, setGroupBy] = React.useState<GroupBy>("repo");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [anchor, setAnchor] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");

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

  const searching = query.trim().length > 0;

  // Fuzzy filter across title, repo, owner and number.
  const filtered = React.useMemo(() => {
    const list = prs ?? [];
    if (!searching) return list;
    return list.filter((pr) => fuzzy(query, `${pr.repo} #${pr.number} ${pr.title} ${pr.owner}`));
  }, [prs, query, searching]);

  const groups = React.useMemo(() => {
    if (groupBy === "none") return [{ key: "", type: "", prs: filtered }];

    if (groupBy === "date") {
      const map = new Map<string, GhPull[]>();
      for (const pr of filtered) {
        const key = dateBucket(pr.updatedAt);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(pr);
      }
      // Fixed chronological order (list already sorted newest-first within each).
      return DATE_BUCKETS.filter((b) => map.has(b)).map((key) => ({ key, type: "date", prs: map.get(key)! }));
    }

    const map = new Map<string, GhPull[]>();
    const typeOf = new Map<string, string>();
    for (const pr of filtered) {
      const key = groupBy === "org" ? pr.owner : pr.repo;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pr);
      typeOf.set(key, pr.ownerType);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([key, prs]) => ({ key, type: typeOf.get(key) ?? "", prs }));
  }, [filtered, groupBy]);

  // Visual order of PR ids (across groups) — drives Shift range-select.
  const orderedIds = React.useMemo(() => groups.flatMap((g) => g.prs.map((p) => p.id)), [groups]);
  const byId = React.useMemo(() => new Map((prs ?? []).map((p) => [p.id, p])), [prs]);

  // Groups start collapsed; changing the grouping recollapses.
  React.useEffect(() => setExpanded(new Set()), [groupBy]);

  const isOpen = (key: string) => groupBy === "none" || searching || expanded.has(key);

  // Only currently-visible rows participate in Shift range-select, so a range
  // never sweeps up PRs hidden inside collapsed groups.
  const visibleIds = React.useMemo(
    () => groups.flatMap((g) => (isOpen(g.key) ? g.prs.map((p) => p.id) : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, expanded, searching, groupBy]
  );
  const toggleGroup = (key: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  const allExpanded = groups.length > 0 && groups.every((g) => expanded.has(g.key));
  const toggleAll = () => setExpanded(allExpanded ? new Set() : new Set(groups.map((g) => g.key)));

  // Select / deselect every PR in a group (for quick copy of a whole org/repo).
  const selectGroup = (g: { prs: GhPull[] }) => {
    const ids = g.prs.map((p) => p.id);
    const allSel = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (allSel ? n.delete(id) : n.add(id)));
      return n;
    });
  };

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  // Click: plain = open on GitHub; ⌘/Ctrl = toggle one; Shift = select the range
  // (over visible rows) from the anchor; a plain click while a selection exists
  // toggles instead of opening.
  const onRowClick = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey) {
      e.preventDefault();
      const a = visibleIds.indexOf(anchor ?? id);
      const b = visibleIds.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        setSelected((prev) => new Set([...prev, ...visibleIds.slice(lo, hi + 1)]));
      } else setSelected((prev) => toggle(prev, id));
      setAnchor(id);
    } else if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      setSelected((prev) => toggle(prev, id));
      setAnchor(id);
    } else if (selected.size > 0) {
      e.preventDefault();
      setSelected((prev) => toggle(prev, id));
      setAnchor(id);
    } else {
      setAnchor(id);
      window.open(byId.get(id)?.url, "_blank", "noopener,noreferrer");
    }
  };

  const copySelected = React.useCallback(async () => {
    const chosen = orderedIds.filter((id) => selected.has(id)).map((id) => byId.get(id)!).filter(Boolean);
    if (chosen.length === 0) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(chosen));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[prs] copy failed", e);
    }
  }, [orderedIds, selected, byId]);

  const clearSelection = () => setSelected(new Set());

  // ⌘/Ctrl+C copies the selection as markdown links; Escape clears it. We defer
  // to a real text selection so ordinary copy still works.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selected.size > 0) {
        clearSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        if (selected.size === 0) return;
        if (window.getSelection?.()?.toString()) return; // let normal text copy happen
        e.preventDefault();
        void copySelected();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, copySelected]);

  // Selecting rows disables the browser's text selection so Shift+click ranges
  // don't also highlight text.
  const userSelect = selected.size > 0 ? "select-none" : "";

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-2.5">
        <GitPullRequest className="h-4 w-4 text-ink-tertiary" />
        <span className="text-[13px] font-medium text-ink">PRs</span>
        {selected.size > 0 ? (
          <span className="text-[12px] text-brand">{selected.size} selected</span>
        ) : (
          prs && (
            <span className="text-[12px] text-ink-tertiary">
              {searching ? `${filtered.length} of ${prs.length}` : `${prs.length} open`}
            </span>
          )
        )}
        {error && <span className="ml-2 truncate text-[12px] text-danger">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          {groupBy !== "none" && groups.length > 0 && !searching && (
            <button
              onClick={toggleAll}
              title={allExpanded ? "Collapse all" : "Expand all"}
              className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
            >
              {allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
            </button>
          )}
          {selected.size > 0 && (
            <>
              <button
                onClick={() => void copySelected()}
                title="Copy selected as markdown links (⌘/Ctrl+C)"
                className="flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-[12px] text-ink-subtle hover:border-hairline-strong hover:text-ink"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy links"}
              </button>
              <button
                onClick={clearSelection}
                title="Clear selection (Esc)"
                className="rounded-md px-2 py-1 text-[12px] text-ink-tertiary hover:text-ink"
              >
                Clear
              </button>
            </>
          )}
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

      {prs && prs.length > 0 && (
        <div className="border-b border-hairline px-5 py-2">
          <div className="mx-auto flex max-w-[900px] items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PRs, repos, orgs…"
              className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-tertiary"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                title="Clear search"
                className="rounded p-0.5 text-ink-tertiary hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={cn("mx-auto w-full max-w-[900px] flex-1 overflow-y-auto px-6 py-5", userSelect)}>
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
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
            <Search className="h-7 w-7 text-ink-tertiary" />
            <p className="text-[13px]">No PRs match “{query.trim()}”.</p>
          </div>
        ) : groupBy === "none" ? (
          <div className="space-y-0.5">
            {groups[0].prs.map((pr) => (
              <PRRow
                key={pr.id}
                pr={pr}
                showRepo
                selected={selected.has(pr.id)}
                onClick={(e) => onRowClick(e, pr.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {groups.map((g) => {
              const open = isOpen(g.key);
              const groupSelected = g.prs.every((p) => selected.has(p.id));
              return (
                <div key={g.key || "all"}>
                  <div className="group flex items-center gap-1 rounded-md pr-1 hover:bg-surface-1">
                    <button
                      onClick={() => toggleGroup(g.key)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left"
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                      )}
                      {g.type === "date" ? (
                        <Calendar className="h-4 w-4 shrink-0 text-ink-tertiary" />
                      ) : g.type === "Organization" ? (
                        <Building2 className="h-4 w-4 shrink-0 text-ink-tertiary" />
                      ) : (
                        <User className="h-4 w-4 shrink-0 text-ink-tertiary" />
                      )}
                      <span className="truncate text-[13px] font-medium text-ink-muted">{g.key}</span>
                      <span className="text-[11px] text-ink-tertiary">{g.prs.length}</span>
                    </button>
                    <button
                      onClick={() => selectGroup(g)}
                      title={groupSelected ? "Deselect all in group" : "Select all in group"}
                      className={cn(
                        "rounded p-1 text-ink-tertiary hover:text-ink",
                        groupSelected ? "text-brand opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {open && (
                    <div className="ml-[9px] space-y-0.5 border-l border-hairline pl-3">
                      {g.prs.map((pr) => (
                        <PRRow
                          key={pr.id}
                          pr={pr}
                          showRepo={groupBy !== "repo"}
                          selected={selected.has(pr.id)}
                          onClick={(e) => onRowClick(e, pr.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
    { key: "date", label: "Date" },
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
