import { create } from "zustand";

export type PaletteMode = "root" | "status" | "priority" | "assignee" | "label";

interface Palette {
  open: boolean;
  mode: PaletteMode;
  /** Issues a chosen action applies to (empty = create/navigate commands). */
  targets: string[];
}

interface UIState {
  /** Issue open in the slide-over panel. */
  openIssueId: string | null;
  /** Keyboard-focused card. */
  focusedIssueId: string | null;
  /** Multi-select set for bulk keyboard actions. */
  selection: Set<string>;
  palette: Palette;

  openIssue: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  openPalette: (mode?: PaletteMode, targets?: string[]) => void;
  closePalette: () => void;
}

export const useUI = create<UIState>((set) => ({
  openIssueId: null,
  focusedIssueId: null,
  selection: new Set(),
  palette: { open: false, mode: "root", targets: [] },

  openIssue: (id) => set({ openIssueId: id }),
  setFocus: (id) => set({ focusedIssueId: id }),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selection);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selection: next };
    }),
  clearSelection: () => set({ selection: new Set() }),
  openPalette: (mode = "root", targets = []) =>
    set({ palette: { open: true, mode, targets } }),
  closePalette: () => set((s) => ({ palette: { ...s.palette, open: false } })),
}));
