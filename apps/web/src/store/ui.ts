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
  /** Range-select anchor (last card clicked without shift). */
  anchorId: string | null;
  palette: Palette;
  helpOpen: boolean;
  githubOpen: boolean;
  /** Create-issue modal: closed (null) or open, optionally editing a draft /
   *  pre-filling a state. */
  create: { open: boolean; draftId?: string; stateId?: string } | null;

  openIssue: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  select: (ids: string[]) => void;
  addSelection: (ids: string[]) => void;
  setAnchor: (id: string | null) => void;
  clearSelection: () => void;
  openPalette: (mode?: PaletteMode, targets?: string[]) => void;
  closePalette: () => void;
  setHelp: (open: boolean) => void;
  setGithub: (open: boolean) => void;
  openCreate: (opts?: { draftId?: string; stateId?: string }) => void;
  closeCreate: () => void;
}

export const useUI = create<UIState>((set) => ({
  openIssueId: null,
  focusedIssueId: null,
  selection: new Set(),
  anchorId: null,
  palette: { open: false, mode: "root", targets: [] },
  helpOpen: false,
  githubOpen: false,
  create: null,

  openIssue: (id) => set({ openIssueId: id }),
  setFocus: (id) => set({ focusedIssueId: id }),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selection);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selection: next, anchorId: id };
    }),
  select: (ids) => set({ selection: new Set(ids) }),
  addSelection: (ids) =>
    set((s) => {
      const next = new Set(s.selection);
      ids.forEach((id) => next.add(id));
      return { selection: next };
    }),
  setAnchor: (id) => set({ anchorId: id }),
  clearSelection: () => set({ selection: new Set(), anchorId: null }),
  openPalette: (mode = "root", targets = []) =>
    set({ palette: { open: true, mode, targets } }),
  closePalette: () => set((s) => ({ palette: { ...s.palette, open: false } })),
  setHelp: (open) => set({ helpOpen: open }),
  setGithub: (open) => set({ githubOpen: open }),
  openCreate: (opts) => set({ create: { open: true, ...opts } }),
  closeCreate: () => set({ create: null }),
}));
