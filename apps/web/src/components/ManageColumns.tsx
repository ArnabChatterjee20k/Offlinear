import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronUp, ChevronDown, Trash2, Plus, Columns3 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StateIcon } from "./icons";
import { db } from "@/db/db";
import { useStates } from "@/hooks/useData";
import { createState, deleteState, updateState } from "@/store/mutations";

export function ManageColumns({ open, onClose }: { open: boolean; onClose: () => void }) {
  const states = useStates(); // ordered by position
  const [name, setName] = React.useState("");

  // Issue count per state (only empty columns can be removed).
  const counts =
    useLiveQuery(async () => {
      const all = await db.issues.toArray();
      const m: Record<string, number> = {};
      for (const i of all) if (!i.archivedAt) m[i.stateId] = (m[i.stateId] ?? 0) + 1;
      return m;
    }, []) ?? {};

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= states.length) return;
    const a = states[i];
    const b = states[j];
    void updateState(a.id, { position: b.position });
    void updateState(b.id, { position: a.position });
  };

  const add = () => {
    const n = name.trim();
    if (!n) return;
    void createState({ name: n });
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-[480px] p-0">
        <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
          <Columns3 className="h-4 w-4 text-ink" />
          <DialogTitle className="text-[15px] font-medium text-ink">Manage columns</DialogTitle>
        </div>

        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto p-4">
          {states.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border border-hairline bg-surface-1 px-2 py-1.5">
              <div className="flex flex-col">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-ink-tertiary hover:text-ink disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === states.length - 1}
                  className="text-ink-tertiary hover:text-ink disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <StateIcon state={s} />
              <Input
                defaultValue={s.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) void updateState(s.id, { name: v });
                }}
                className="h-7 flex-1 border-0 bg-transparent px-1 focus-visible:bg-surface-2"
              />
              <span className="text-[11px] text-ink-tertiary">{counts[s.id] ?? 0}</span>
              <button
                onClick={() => (counts[s.id] ? undefined : deleteState(s.id))}
                disabled={!!counts[s.id]}
                title={counts[s.id] ? "Column must be empty to delete" : "Delete column"}
                className="rounded p-1 text-ink-tertiary hover:text-danger disabled:opacity-30 disabled:hover:text-ink-tertiary"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-hairline px-4 py-3">
          <Input
            placeholder="New column name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button variant="primary" size="sm" disabled={!name.trim()} onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
