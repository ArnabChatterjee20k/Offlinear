// Shared CSV → entity mapping used by both the local seed generator and the
// Appwrite importer. Pure: takes CSV rows, returns entity collections.

import { parse } from "csv-parse/sync";
import {
  CSV_PRIORITY,
  CSV_STATUS_TO_STATE,
  DEFAULT_STATES,
  type Comment,
  type Issue,
  type Label,
  type Member,
  type State,
  type Team,
} from "@offlinear/shared";

export interface Dataset {
  teams: Team[];
  states: State[];
  labels: Label[];
  members: Member[];
  issues: Issue[];
  comments: Comment[];
  generatedAt: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

const stateId = (name: string) => `state_${slug(name)}`;
const teamId = (name: string) => `team_${slug(name)}`;
const labelId = (name: string) => `label_${slug(name)}`;
const memberId = (email: string) => `user_${slug(email)}`;

const iso = (v: string | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const keys = (v: string | undefined): string[] =>
  (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function mapDataset(csv: string): Dataset {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: false,
  }) as Record<string, string>[];

  const now = new Date().toISOString();
  const base = { createdAt: now, updatedAt: now, rev: 1 };

  const teams = new Map<string, Team>();
  const labels = new Map<string, Label>();
  const members = new Map<string, Member>();

  // States are fixed (the canonical set), keyed by name.
  const states: State[] = DEFAULT_STATES.map((s) => ({
    ...base,
    id: stateId(s.name),
    teamId: "",
    name: s.name,
    type: s.type,
    color: s.color,
    position: s.position,
    githubOptionId: null,
  }));

  const upsertTeam = (name: string) => {
    if (!name) return "";
    const id = teamId(name);
    if (!teams.has(id)) {
      const key = name.slice(0, 3).toUpperCase();
      teams.set(id, { ...base, id, key, name });
    }
    return id;
  };

  const upsertMember = (email: string) => {
    if (!email) return null;
    const id = memberId(email);
    if (!members.has(id)) {
      members.set(id, {
        ...base,
        id,
        name: email.split("@")[0],
        email,
        avatar: null,
        githubLogin: null,
        isAgent: false,
      });
    }
    return id;
  };

  const upsertLabel = (name: string) => {
    const id = labelId(name);
    if (!labels.has(id)) {
      labels.set(id, {
        ...base,
        id,
        teamId: null,
        name,
        color: "#8a8f98",
      });
    }
    return id;
  };

  // Pass 1: issues (relations resolved in pass 2).
  const issues: Issue[] = [];
  const seen = new Set<string>(); // dedup on UUID
  const perColumn = new Map<string, number>();

  for (const r of rows) {
    const uuid = r["UUID"];
    if (uuid && seen.has(uuid)) continue;
    if (uuid) seen.add(uuid);

    const key = r["ID"];
    if (!key) continue;

    const tId = upsertTeam(r["Team"]);
    const stName = CSV_STATUS_TO_STATE[r["Status"]] ?? "Backlog";
    const sId = stateId(stName);
    const order = perColumn.get(sId) ?? 0;
    perColumn.set(sId, order + 1);

    issues.push({
      ...base,
      id: key,
      key,
      teamId: tId,
      title: r["Title"] || "(untitled)",
      description: r["Description"] || "",
      stateId: sId,
      priority: CSV_PRIORITY[r["Priority"]] ?? 0,
      estimate: r["Estimate"] ? Number(r["Estimate"]) || null : null,
      assigneeId: upsertMember(r["Assignee"]),
      creatorId: upsertMember(r["Creator"]),
      labelIds: keys(r["Labels"]).map(upsertLabel),
      dueDate: iso(r["Due Date"]),
      parentId: null,
      relatedIds: [],
      blockedByIds: [],
      duplicateOfId: null,
      boardOrder: order,
      createdAt: iso(r["Created"]) ?? now,
      updatedAt: iso(r["Updated"]) ?? now,
      startedAt: iso(r["Started"]),
      completedAt: iso(r["Completed"]),
      canceledAt: iso(r["Canceled"]),
      archivedAt: iso(r["Archived"]),
      rev: 1,
    });
  }

  // Pass 2: resolve relations to ids that actually exist.
  const exists = new Set(issues.map((i) => i.id));
  const keep = (arr: string[]) => arr.filter((k) => exists.has(k));
  const byKey = new Map(rows.map((r) => [r["ID"], r]));

  for (const issue of issues) {
    const r = byKey.get(issue.key);
    if (!r) continue;
    const parent = keys(r["Parent issue"]).find((k) => exists.has(k));
    issue.parentId = parent ?? null;
    issue.relatedIds = keep(keys(r["Related to"]));
    issue.blockedByIds = keep(keys(r["Blocked by"]));
    issue.duplicateOfId = keys(r["Duplicate of"]).find((k) => exists.has(k)) ?? null;
  }

  return {
    teams: [...teams.values()],
    states,
    labels: [...labels.values()],
    members: [...members.values()],
    issues,
    comments: [],
    generatedAt: now,
  };
}
