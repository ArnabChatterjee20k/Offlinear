import { create } from "zustand";

/** Minimal history-based routing: only the board (/) and an issue page
 *  (/issue/:id) exist. Deep-linkable and back-button aware. */
function parse(): string | null {
  const m = window.location.pathname.match(/^\/issue\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

interface RouteState {
  issueId: string | null;
}

export const useRoute = create<RouteState>(() => ({ issueId: parse() }));

/** Navigate to an issue page (or back to the board when id is null). */
export function openIssuePage(id: string | null): void {
  const path = id ? `/issue/${encodeURIComponent(id)}` : "/";
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
  useRoute.setState({ issueId: id });
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => useRoute.setState({ issueId: parse() }));
}
