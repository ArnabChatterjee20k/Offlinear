import type { Comment, Issue, Label, Member, State, Team } from "@offlinear/shared";
import { db } from "./db";

interface SeedFile {
  teams: Team[];
  states: State[];
  labels: Label[];
  members: Member[];
  issues: Issue[];
  comments: Comment[];
  generatedAt: string;
}

/**
 * On first run, load public/seed.json into IndexedDB. Idempotent: guarded by a
 * meta flag so it never re-imports over local edits.
 */
export async function ensureSeeded(): Promise<void> {
  const done = await db.meta.get("seeded");
  if (done) return;

  const res = await fetch("/seed.json");
  if (!res.ok) throw new Error(`seed.json ${res.status}`);
  const data = (await res.json()) as SeedFile;

  await db.transaction(
    "rw",
    [db.teams, db.states, db.labels, db.members, db.issues, db.comments, db.meta],
    async () => {
      await db.teams.bulkPut(data.teams);
      await db.states.bulkPut(data.states);
      await db.labels.bulkPut(data.labels);
      await db.members.bulkPut(data.members);
      await db.issues.bulkPut(data.issues);
      await db.comments.bulkPut(data.comments);
      await db.meta.put({ key: "seeded", value: data.generatedAt });
    }
  );
}
