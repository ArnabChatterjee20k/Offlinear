import { useEffect } from "react";
import { useUI } from "@/store/ui";
import { createIssue } from "@/store/mutations";

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || n.isContentEditable;
};

/** Ordered list of visible board card ids, left-to-right, top-to-bottom. */
function boardCardIds(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>("#board [data-issue-id]");
  return [...nodes].map((n) => n.dataset.issueId!).filter(Boolean);
}

/**
 * Global keyboard-first controls. Single-key actions operate on the current
 * target (multi-selection, else the focused card). ⌘K and Escape work even
 * while typing; other keys are ignored inside inputs.
 */
export function useKeyboard() {
  const ui = useUI;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = ui.getState();

      // Command palette — always available.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.palette.open ? s.closePalette() : s.openPalette();
        return;
      }

      if (e.key === "Escape") {
        if (s.palette.open) return; // Dialog handles it
        if (s.openIssueId) return; // Sheet handles it
        if (s.selection.size) s.clearSelection();
        return;
      }

      if (s.palette.open || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      const ids = boardCardIds();
      const idx = s.focusedIssueId ? ids.indexOf(s.focusedIssueId) : -1;
      const focused = s.focusedIssueId;
      const targets = s.selection.size ? [...s.selection] : focused ? [focused] : [];

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          s.setFocus(ids[Math.min(idx + 1, ids.length - 1)] ?? ids[0] ?? null);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          s.setFocus(ids[Math.max(idx - 1, 0)] ?? null);
          break;
        case "Enter":
          if (focused) {
            e.preventDefault();
            s.openIssue(focused);
          }
          break;
        case "x":
          if (focused) {
            e.preventDefault();
            s.toggleSelect(focused);
          }
          break;
        case "c":
          e.preventDefault();
          void createIssue({ title: "New issue" }).then((id) => s.openIssue(id));
          break;
        case "s":
          if (targets.length) s.openPalette("status", targets);
          break;
        case "p":
          if (targets.length) s.openPalette("priority", targets);
          break;
        case "a":
          if (targets.length) s.openPalette("assignee", targets);
          break;
        case "l":
          if (targets.length) s.openPalette("label", targets);
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui]);
}
