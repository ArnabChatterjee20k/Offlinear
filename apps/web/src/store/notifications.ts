import { create } from "zustand";
import { db } from "@/db/db";

export interface GistConflict {
  reportId: string;
  gistId: string;
  localBody: string;
  remoteBody: string;
  remoteUpdatedAt: string;
}

export interface AppNotification {
  id: string;
  kind: "gist-conflict" | "error" | "info";
  title: string;
  message: string;
  createdAt: string;
  conflict?: GistConflict;
}

interface NotifState {
  items: AppNotification[];
  /** Report whose gist conflict is being resolved (opens the merge modal). */
  resolving: string | null;
  add: (n: Omit<AppNotification, "id" | "createdAt">) => void;
  dismiss: (id: string) => void;
  dismissConflict: (reportId: string) => void;
  setResolving: (reportId: string | null) => void;
  clear: () => void;
}

export const useNotifications = create<NotifState>((set) => ({
  items: [],
  resolving: null,
  add: (n) =>
    set((s) => {
      // Collapse duplicate conflicts for the same report.
      const dropped =
        n.kind === "gist-conflict"
          ? s.items.filter((x) => x.conflict?.reportId === n.conflict?.reportId)
          : [];
      const item = { ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      void db.notifications.bulkDelete(dropped.map((d) => d.id)).then(() => db.notifications.put(item));
      return { items: [item, ...s.items.filter((x) => !dropped.includes(x))] };
    }),
  dismiss: (id) => {
    void db.notifications.delete(id);
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
  },
  dismissConflict: (reportId) =>
    set((s) => {
      const gone = s.items.filter((x) => x.conflict?.reportId === reportId);
      void db.notifications.bulkDelete(gone.map((g) => g.id));
      return { items: s.items.filter((x) => x.conflict?.reportId !== reportId) };
    }),
  setResolving: (reportId) => set({ resolving: reportId }),
  clear: () => {
    void db.notifications.clear();
    set({ items: [] });
  },
}));

/** Load persisted notifications at startup. */
export async function loadNotifications(): Promise<void> {
  const items = await db.notifications.orderBy("createdAt").reverse().toArray();
  useNotifications.setState({ items });
}
