// Seed defaults shared by the importer, the schema, and the client.

import type { StateType, Priority } from "./types.js";

export interface SeedState {
  name: string;
  type: StateType;
  color: string;
  position: number;
}

/** The canonical workflow-state set (Linear-like). Positions drive column order. */
export const DEFAULT_STATES: SeedState[] = [
  { name: "Backlog", type: "backlog", color: "#8a8f98", position: 0 },
  { name: "Todo", type: "unstarted", color: "#a0a0a5", position: 1 },
  { name: "In Progress", type: "started", color: "#f2c94c", position: 2 },
  { name: "In Review", type: "started", color: "#5e6ad2", position: 3 },
  { name: "Done", type: "completed", color: "#27a644", position: 4 },
  { name: "Canceled", type: "canceled", color: "#62666d", position: 5 },
  { name: "Duplicate", type: "canceled", color: "#62666d", position: 6 },
];

/** Map raw Linear CSV status strings onto our canonical state names. */
export const CSV_STATUS_TO_STATE: Record<string, string> = {
  Backlog: "Backlog",
  Todo: "Todo",
  "In Progress": "In Progress",
  "In Review": "In Review",
  "Code review": "In Review",
  Done: "Done",
  Canceled: "Canceled",
  Duplicate: "Duplicate",
};

export const CSV_PRIORITY: Record<string, Priority> = {
  "No priority": 0,
  Urgent: 1,
  High: 2,
  Medium: 3,
  Low: 4,
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  0: "#62666d",
  1: "#e5484d",
  2: "#f2994a",
  3: "#f2c94c",
  4: "#8a8f98",
};
