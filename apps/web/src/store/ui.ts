import { create } from "zustand";

interface UIState {
  /** Issue open in the slide-over panel. */
  openIssueId: string | null;
  /** Keyboard-focused card. */
  focusedIssueId: string | null;
  /** Multi-select set for bulk keyboard actions. */
  selection: Set<string>;
  paletteOpen: boolean;

  openIssue: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setPalette: (open: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  openIssueId: null,
  focusedIssueId: null,
  selection: new Set(),
  paletteOpen: false,

  openIssue: (id) => set({ openIssueId: id }),
  setFocus: (id) => set({ focusedIssueId: id }),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selection);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selection: next };
    }),
  clearSelection: () => set({ selection: new Set() }),
  setPalette: (open) => set({ paletteOpen: open }),
}));
