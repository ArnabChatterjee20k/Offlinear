import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Label, Member, State } from "@offlinear/shared";
import { db } from "@/db/db";

export interface SubCount {
  total: number;
  done: number;
}

interface Lookups {
  stateById: Map<string, State>;
  memberById: Map<string, Member>;
  labelById: Map<string, Label>;
  subCountByParent: Map<string, SubCount>;
}

const empty: Lookups = {
  stateById: new Map(),
  memberById: new Map(),
  labelById: new Map(),
  subCountByParent: new Map(),
};

const LookupContext = React.createContext<Lookups>(empty);

/**
 * One place that subscribes to states/members/labels and computes sub-issue
 * counts — instead of every card running its own live queries. Rendering
 * hundreds of cards then costs zero extra Dexie subscriptions.
 */
export function LookupProvider({ children }: { children: React.ReactNode }) {
  const states = useLiveQuery(() => db.states.orderBy("position").toArray(), [], []);
  const members = useLiveQuery(() => db.members.toArray(), [], []);
  const labels = useLiveQuery(() => db.labels.toArray(), [], []);
  // Only rows that ARE sub-issues; keyed by parent for O(1) count lookup.
  const children_ = useLiveQuery(
    () => db.issues.filter((i) => !!i.parentId).toArray(),
    [],
    []
  );

  const value = React.useMemo<Lookups>(() => {
    const stateById = new Map(states.map((s) => [s.id, s]));
    const subCountByParent = new Map<string, SubCount>();
    for (const c of children_) {
      const e = subCountByParent.get(c.parentId!) ?? { total: 0, done: 0 };
      e.total++;
      if (stateById.get(c.stateId)?.type === "completed") e.done++;
      subCountByParent.set(c.parentId!, e);
    }
    return {
      stateById,
      memberById: new Map(members.map((m) => [m.id, m])),
      labelById: new Map(labels.map((l) => [l.id, l])),
      subCountByParent,
    };
  }, [states, members, labels, children_]);

  return <LookupContext.Provider value={value}>{children}</LookupContext.Provider>;
}

export const useLookupCtx = () => React.useContext(LookupContext);
