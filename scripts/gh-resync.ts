// One-shot full re-sync of a project's GitHub board: delete our draft items,
// clear sync_map, and recreate exactly the current DB issues (deduped).
// Uses settings.app.githubToken (org-scoped) — the same token the function uses.
//   pnpm --filter @offlinear/scripts exec tsx gh-resync.ts
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, TablesDB, Query } from "node-appwrite";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env") });
const DB = process.env.APPWRITE_DATABASE_ID!;
const c = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);
const t = new TablesDB(c);

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();

async function main() {
  const settings: any = await t.getRow(DB, "settings", "app");
  const token: string = settings.githubToken;
  const boardId: string = settings.githubProjectId;
  if (!token || !boardId) throw new Error("settings.app missing githubToken/githubProjectId");

  const gql = async (query: string, variables: any = {}) => {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const j: any = await r.json();
    if (j.errors) throw new Error(j.errors.map((e: any) => e.message).join("; "));
    if (!j.data) throw new Error(`GitHub ${r.status}: ${j.message || "no data"}`);
    return j.data;
  };

  // Which local projects map to this board.
  const projs: any = await t.listRows(DB, "projects", [Query.limit(100)]);
  const localProjectIds = projs.rows.filter((p: any) => p.githubProjectId === boardId).map((p: any) => p.$id);
  console.log("board:", boardId, "| local projects:", localProjectIds);

  // 1. Delete every DRAFT item on the board (preserve real issues/PRs).
  let deleted = 0;
  let cursor: string | null = null;
  do {
    const data: any = await gql(
      `query($id:ID!,$c:String){ node(id:$id){ ... on ProjectV2 { items(first:100,after:$c){
        pageInfo{hasNextPage endCursor} nodes{ id content{ __typename } } } } } }`,
      { id: boardId, c: cursor }
    );
    const items = data.node.items;
    for (const it of items.nodes) {
      if (it.content?.__typename === "DraftIssue") {
        await gql(
          `mutation($p:ID!,$i:ID!){ deleteProjectV2Item(input:{projectId:$p,itemId:$i}){ deletedItemId } }`,
          { p: boardId, i: it.id }
        );
        deleted++;
        if (deleted % 20 === 0) process.stdout.write(`\rdeleted ${deleted} drafts…`);
      }
    }
    cursor = items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null;
  } while (cursor);
  console.log(`\ndeleted ${deleted} draft items`);

  // 2. Clear sync_map.
  let cleared = 0;
  while (true) {
    const page: any = await t.listRows(DB, "sync_map", [Query.limit(100)]);
    if (page.rows.length === 0) break;
    for (const r of page.rows) {
      await t.deleteRow(DB, "sync_map", r.$id);
      cleared++;
    }
  }
  console.log(`cleared ${cleared} sync_map rows`);

  // 3. Status field options.
  const fd: any = await gql(
    `query($id:ID!){ node(id:$id){ ... on ProjectV2 { field(name:"Status"){ ... on ProjectV2SingleSelectField { id options{ id name } } } } } }`,
    { id: boardId }
  );
  const field = fd.node.field;
  const optByName = new Map<string, string>((field?.options ?? []).map((o: any) => [norm(o.name), o.id]));
  const states: any = await t.listRows(DB, "states", [Query.limit(100)]);
  const stateName = new Map<string, string>(states.rows.map((s: any) => [s.$id, s.name]));

  // 4. Recreate one draft per current issue in the mapped project(s).
  let created = 0;
  let icur: string | null = null;
  do {
    const q = [Query.limit(100), Query.orderAsc("$createdAt")];
    if (icur) q.push(Query.cursorAfter(icur));
    const page: any = await t.listRows(DB, "issues", q);
    for (const issue of page.rows) {
      if (!localProjectIds.includes(issue.projectId) || issue.archivedAt) continue;
      const data: any = await gql(
        `mutation($p:ID!,$t:String!,$b:String){ addProjectV2DraftIssue(input:{projectId:$p,title:$t,body:$b}){ projectItem{ id } } }`,
        { p: boardId, t: issue.title, b: issue.description || "" }
      );
      const itemId = data.addProjectV2DraftIssue.projectItem.id;
      const optId = optByName.get(norm(stateName.get(issue.stateId) ?? ""));
      if (field && optId) {
        await gql(
          `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }`,
          { p: boardId, i: itemId, f: field.id, o: optId }
        );
      }
      const now = new Date().toISOString();
      await t.upsertRow(DB, "sync_map", issue.$id, { itemId, projectId: boardId, rev: 1, createdAt: now, updatedAt: now });
      created++;
      if (created % 10 === 0) process.stdout.write(`\rcreated ${created}…`);
    }
    icur = page.rows.length === 100 ? page.rows[page.rows.length - 1].$id : null;
  } while (icur);
  console.log(`\nrecreated ${created} items. Board now matches the DB.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
