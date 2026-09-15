import { useLiveQuery } from "dexie-react-hooks";
import type { Issue } from "@offlinear/shared";
import { db } from "@/db/db";

export const useStates = () =>
  useLiveQuery(() => db.states.orderBy("position").toArray(), [], []);

export const useMembers = () => useLiveQuery(() => db.members.toArray(), [], []);
export const useLabels = () => useLiveQuery(() => db.labels.toArray(), [], []);
export const useTeams = () => useLiveQuery(() => db.teams.toArray(), [], []);

/** Top-level issues (no parent), ordered for the board. */
export const useBoardIssues = () =>
  useLiveQuery(
    () => db.issues.filter((i) => !i.parentId && !i.archivedAt).toArray(),
    [],
    [] as Issue[]
  );

export const useIssue = (id: string | null) =>
  useLiveQuery(() => (id ? db.issues.get(id) : undefined), [id]);

export const useSubIssues = (parentId: string | null) =>
  useLiveQuery(
    () => (parentId ? db.issues.where("parentId").equals(parentId).toArray() : []),
    [parentId],
    [] as Issue[]
  );

export const useDrafts = () =>
  useLiveQuery(() => db.drafts.orderBy("updatedAt").reverse().toArray(), [], []);

export const useComments = (issueId: string | null) =>
  useLiveQuery(
    () =>
      issueId
        ? db.comments.where("issueId").equals(issueId).sortBy("createdAt")
        : [],
    [issueId],
    []
  );

export const useIssuesByIds = (ids: string[]) =>
  useLiveQuery(
    () => db.issues.where("id").anyOf(ids).toArray(),
    [ids.join(",")],
    [] as Issue[]
  );

/** Lightweight lookup maps for rendering chips without N queries. */
export function useLookups() {
  const states = useStates();
  const members = useMembers();
  const labels = useLabels();
  return {
    stateById: new Map(states.map((s) => [s.id, s])),
    memberById: new Map(members.map((m) => [m.id, m])),
    labelById: new Map(labels.map((l) => [l.id, l])),
    states,
    members,
    labels,
  };
}
