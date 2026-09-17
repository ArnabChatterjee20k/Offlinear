import { create } from "zustand";

/** Minimal history-based routing: the board (/), an issue page (/issue/:id),
 *  or a report page (/report/:id). Deep-linkable and back-button aware. */
interface RouteState {
  issueId: string | null;
  reportId: string | null;
}

function parse(): RouteState {
  const path = window.location.pathname;
  const issue = path.match(/^\/issue\/(.+)$/);
  const report = path.match(/^\/report\/(.+)$/);
  return {
    issueId: issue ? decodeURIComponent(issue[1]) : null,
    reportId: report ? decodeURIComponent(report[1]) : null,
  };
}

export const useRoute = create<RouteState>(() => parse());

function go(path: string, next: RouteState) {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  useRoute.setState(next);
}

export const openIssuePage = (id: string | null) =>
  id ? go(`/issue/${encodeURIComponent(id)}`, { issueId: id, reportId: null }) : go("/", { issueId: null, reportId: null });

export const openReportPage = (id: string | null) =>
  id ? go(`/report/${encodeURIComponent(id)}`, { issueId: null, reportId: id }) : go("/", { issueId: null, reportId: null });

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => useRoute.setState(parse()));
}
