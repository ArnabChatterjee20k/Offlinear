import {
  makeOp,
  newOpId,
  type Comment,
  type Issue,
  type Priority,
  type RelationKind,
} from "@offlinear/shared";
import { db } from "@/db/db";
import { commit } from "@/sync/engine";
import { getActorId, getTeamId } from "./session";

const nowIso = () => new Date().toISOString();

async function nextKey(): Promise<string> {
  const team = await db.teams.get(getTeamId() ?? "");
  const prefix = team?.key ?? "OFL";
  const all = await db.issues.toArray();
  const max = all
    .map((i) => Number(i.key.split("-")[1]) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${max + 1}`;
}

async function nextBoardOrder(stateId: string): Promise<number> {
  const inCol = await db.issues.where("stateId").equals(stateId).toArray();
  return inCol.reduce((a, b) => Math.max(a, b.boardOrder), 0) + 1;
}

/** Create an issue. Returns its id so callers can open it. */
export async function createIssue(
  input: Partial<Issue> & { title: string }
): Promise<string> {
  const id = input.id ?? newOpId();
  const stateId = input.stateId ?? (await defaultStateId());
  const full: Omit<Issue, "createdAt" | "updatedAt" | "rev"> = {
    id,
    key: input.key ?? (await nextKey()),
    teamId: input.teamId ?? getTeamId() ?? "",
    title: input.title,
    description: input.description ?? "",
    stateId,
    priority: input.priority ?? 0,
    estimate: input.estimate ?? null,
    assigneeId: input.assigneeId ?? getActorId(),
    creatorId: getActorId(),
    labelIds: input.labelIds ?? [],
    dueDate: input.dueDate ?? null,
    parentId: input.parentId ?? null,
    relatedIds: input.relatedIds ?? [],
    blockedByIds: input.blockedByIds ?? [],
    duplicateOfId: input.duplicateOfId ?? null,
    boardOrder: input.boardOrder ?? (await nextBoardOrder(stateId)),
    startedAt: null,
    completedAt: null,
    canceledAt: null,
    archivedAt: null,
  };
  await commit(
    makeOp<Issue>({
      entity: "issues",
      entityId: id,
      type: "create",
      patch: full as Partial<Issue>,
      baseRev: 0,
      actorId: getActorId(),
    })
  );
  return id;
}

async function defaultStateId(): Promise<string> {
  const states = await db.states.orderBy("position").toArray();
  const todo = states.find((s) => s.type === "unstarted") ?? states[0];
  return todo?.id ?? "";
}

export async function updateIssue(id: string, patch: Partial<Issue>): Promise<void> {
  const current = await db.issues.get(id);
  if (!current) return;
  await commit(
    makeOp<Issue>({
      entity: "issues",
      entityId: id,
      type: "update",
      patch,
      baseRev: current.rev,
      actorId: getActorId(),
    })
  );
}

/** Move an issue to a state, optionally at a given order (drag-drop). */
export async function moveIssue(
  id: string,
  stateId: string,
  boardOrder?: number
): Promise<void> {
  const patch: Partial<Issue> = {
    stateId,
    boardOrder: boardOrder ?? (await nextBoardOrder(stateId)),
  };
  const state = await db.states.get(stateId);
  if (state?.type === "started" ) patch.startedAt = (await db.issues.get(id))?.startedAt ?? nowIso();
  if (state?.type === "completed") patch.completedAt = nowIso();
  if (state?.type === "canceled") patch.canceledAt = nowIso();
  await updateIssue(id, patch);
}

export const setPriority = (id: string, priority: Priority) => updateIssue(id, { priority });
export const setAssignee = (id: string, assigneeId: string | null) =>
  updateIssue(id, { assigneeId });

export async function toggleLabel(id: string, labelId: string): Promise<void> {
  const issue = await db.issues.get(id);
  if (!issue) return;
  const has = issue.labelIds.includes(labelId);
  await updateIssue(id, {
    labelIds: has
      ? issue.labelIds.filter((l) => l !== labelId)
      : [...issue.labelIds, labelId],
  });
}

// --- Relations -------------------------------------------------------------

const REL_FIELD: Record<Exclude<RelationKind, "duplicate_of">, "relatedIds" | "blockedByIds"> = {
  related: "relatedIds",
  blocked_by: "blockedByIds",
};

export async function linkRelation(
  id: string,
  kind: RelationKind,
  targetId: string
): Promise<void> {
  const issue = await db.issues.get(id);
  if (!issue || id === targetId) return;
  if (kind === "duplicate_of") {
    await updateIssue(id, { duplicateOfId: targetId });
    return;
  }
  const field = REL_FIELD[kind];
  if (issue[field].includes(targetId)) return;
  await updateIssue(id, { [field]: [...issue[field], targetId] });
}

export async function unlinkRelation(
  id: string,
  kind: RelationKind,
  targetId: string
): Promise<void> {
  const issue = await db.issues.get(id);
  if (!issue) return;
  if (kind === "duplicate_of") {
    await updateIssue(id, { duplicateOfId: null });
    return;
  }
  const field = REL_FIELD[kind];
  await updateIssue(id, { [field]: issue[field].filter((t) => t !== targetId) });
}

// --- Sub-issues ------------------------------------------------------------

export const addSubIssue = (parentId: string, title: string) =>
  createIssue({ title, parentId });

export const setParent = (id: string, parentId: string | null) =>
  updateIssue(id, { parentId });

// --- Comments --------------------------------------------------------------

export async function addComment(issueId: string, body: string): Promise<void> {
  const id = newOpId();
  const full: Omit<Comment, "createdAt" | "updatedAt" | "rev"> = {
    id,
    issueId,
    authorId: getActorId(),
    body,
    source: "human",
  };
  await commit(
    makeOp<Comment>({
      entity: "comments",
      entityId: id,
      type: "create",
      patch: full as Partial<Comment>,
      baseRev: 0,
      actorId: getActorId(),
    })
  );
}

export async function editComment(id: string, body: string): Promise<void> {
  const current = await db.comments.get(id);
  if (!current) return;
  await commit(
    makeOp<Comment>({
      entity: "comments",
      entityId: id,
      type: "update",
      patch: { body },
      baseRev: current.rev,
      actorId: getActorId(),
    })
  );
}

export async function deleteComment(id: string): Promise<void> {
  const current = await db.comments.get(id);
  if (!current) return;
  await commit(
    makeOp<Comment>({
      entity: "comments",
      entityId: id,
      type: "delete",
      patch: {},
      baseRev: current.rev,
      actorId: getActorId(),
    })
  );
}
