import { useEffect } from "react";
import { db } from "@/db/db";
import { useUI } from "@/store/ui";
import { deleteIssues } from "@/store/mutations";
import { redo, undo } from "@/store/history";
import { boardCardIds } from "@/lib/board-order";
import { openIssuePage, useRoute } from "@/store/route";

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || n.isContentEditable;
};

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

      // Meta/Ctrl combos.
      if (e.metaKey || e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === "k") {
          e.preventDefault();
          s.palette.open ? s.closePalette() : s.openPalette();
          return;
        }
        if (isTyping(e.target)) return; // leave native undo/select in inputs
        if (k === "z") {
          e.preventDefault();
          void (e.shiftKey ? redo() : undo());
        } else if (k === "y") {
          e.preventDefault();
          void redo();
        } else if (k === "a") {
          e.preventDefault();
          void db.issues
            .filter((i) => !i.parentId && !i.archivedAt)
            .toArray()
            .then((rows) => s.select(rows.map((r) => r.id)));
        }
        return;
      }

      if (e.key === "Escape") {
        if (s.palette.open || s.helpOpen) return; // Dialog handles it
        if (useRoute.getState().issueId) {
          openIssuePage(null); // leave the issue page
          return;
        }
        if (s.selection.size) s.clearSelection();
        return;
      }

      if (s.palette.open || s.helpOpen || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey)
        return;

      // "?" (Shift+/) toggles the shortcut sheet.
      if (e.key === "?") {
        e.preventDefault();
        s.setHelp(!s.helpOpen);
        return;
      }

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
        case "Backspace":
        case "Delete":
          if (targets.length) {
            e.preventDefault();
            void deleteIssues(targets);
            s.clearSelection();
            s.setFocus(null);
          }
          break;
        case "c":
          e.preventDefault();
          s.openCreate();
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

    // Track Shift held to reveal card checkboxes.
    const onShiftDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") ui.getState().setShiftHeld(true);
    };
    const onShiftUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") ui.getState().setShiftHeld(false);
    };
    const onBlur = () => ui.getState().setShiftHeld(false);

    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onShiftDown);
    window.addEventListener("keyup", onShiftUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onShiftDown);
      window.removeEventListener("keyup", onShiftUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [ui]);
}
