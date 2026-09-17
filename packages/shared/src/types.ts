// Core entity types. These mirror the Appwrite TablesDB tables and the local
// IndexedDB stores 1:1 — the same shapes flow end to end.

/** Every synced row carries these. `rev` is the server-assigned optimistic-concurrency token. */
export interface Synced {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  rev: number;
}

export type Priority = 0 | 1 | 2 | 3 | 4; // 0 none, 1 urgent, 2 high, 3 medium, 4 low

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

/** Workflow-state category, borrowed from Linear. Drives ordering + semantics. */
export type StateType =
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "canceled";

export interface Team extends Synced {
  key: string; // e.g. "DAT"
  name: string;
}

/** A project = one board, optionally linked to a GitHub Projects v2 board. */
export interface Project extends Synced {
  name: string;
  githubProjectId: string | null;
  githubOwner: string | null;
  githubTitle: string | null;
}

export interface State extends Synced {
  teamId: string;
  name: string;
  type: StateType;
  color: string;
  position: number;
  githubOptionId?: string | null;
}

export interface Label extends Synced {
  teamId: string | null;
  name: string;
  color: string;
}

export interface Member extends Synced {
  name: string;
  email: string;
  avatar?: string | null;
  githubLogin?: string | null;
  isAgent: boolean;
}

export type RelationKind = "related" | "blocked_by" | "duplicate_of";

export interface Issue extends Synced {
  key: string; // "DAT-2519"
  teamId: string;
  projectId: string | null;
  title: string;
  description: string;
  stateId: string;
  priority: Priority;
  estimate: number | null;
  assigneeId: string | null;
  creatorId: string | null;
  labelIds: string[];
  dueDate: string | null;
  parentId: string | null; // sub-issue parent
  relatedIds: string[];
  blockedByIds: string[];
  duplicateOfId: string | null;
  boardOrder: number; // manual ordering within a column
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  archivedAt: string | null;
}

/** A Notion-style document, scoped to a project, cross-linking issues/reports. */
export interface Report extends Synced {
  projectId: string | null;
  title: string;
  body: string; // markdown, with issue:<id> / report:<id> cross-links
  authorId: string | null;
  /** Linked private GitHub Gist id, once published. */
  gistId: string | null;
}

export type CommentSource = "human" | "agent";

export interface Comment extends Synced {
  issueId: string;
  authorId: string | null;
  body: string;
  source: CommentSource;
}

export type EntityName =
  | "teams"
  | "projects"
  | "states"
  | "labels"
  | "members"
  | "issues"
  | "comments"
  | "reports";

export interface EntityMap {
  teams: Team;
  projects: Project;
  states: State;
  labels: Label;
  members: Member;
  issues: Issue;
  comments: Comment;
  reports: Report;
}
