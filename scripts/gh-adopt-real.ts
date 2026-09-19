// Adopt pre-existing REAL board issues (not drafts) into sync_map by title:
// where a DB issue matches a real board item, remap it to that item (deleting
// the redundant draft we made) and set the real item's Status from the DB.
//   pnpm --filter @offlinear/scripts exec tsx gh-adopt-real.ts
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, TablesDB, Query } from "node-appwrite";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env") });
const DB = process.env.APPWRITE_DATABASE_ID!;
const c = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const t = new TablesDB(c);
const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();

async function main() {
  const s: any = await t.getRow(DB, "settings", "app");
  const token = s.githubToken, boardId = s.githubProjectId;
  const gql = async (q: string, v: any = {}) => {
    const r = await fetch("https://api.github.com/graphql", { method: "POST", headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q, variables: v }) });
    const j: any = await r.json();
    if (j.errors) throw new Error(j.errors.map((e: any) => e.message).join("; "));
    return j.data;
  };

  // Map real (non-draft) board items by normalised title.
  const realByTitle = new Map<string, string>();
  let cursor: string | null = null;
  do {
    const d: any = await gql(`query($id:ID!,$c:String){ node(id:$id){ ... on ProjectV2 { items(first:100,after:$c){ pageInfo{hasNextPage endCursor} nodes{ id content{ __typename ... on Issue{title} ... on PullRequest{title} } } } } } }`, { id: boardId, c: cursor });
    for (const it of d.node.items.nodes) {
      const ty = it.content?.__typename;
      if ((ty === "Issue" || ty === "PullRequest") && it.content.title) realByTitle.set(norm(it.content.title), it.id);
    }
    cursor = d.node.items.pageInfo.hasNextPage ? d.node.items.pageInfo.endCursor : null;
  } while (cursor);
  console.log("real board items:", realByTitle.size);

  // Status field options.
  const fd: any = await gql(`query($id:ID!){ node(id:$id){ ... on ProjectV2 { field(name:"Status"){ ... on ProjectV2SingleSelectField { id options{ id name } } } } } }`, { id: boardId });
  const field = fd.node.field;
  const optByName = new Map<string, string>((field?.options ?? []).map((o: any) => [norm(o.name), o.id]));
  const states: any = await t.listRows(DB, "states", [Query.limit(100)]);
  const stateName = new Map<string, string>(states.rows.map((st: any) => [st.$id, st.name]));

  const projs: any = await t.listRows(DB, "projects", [Query.limit(100)]);
  const localIds = projs.rows.filter((p: any) => p.githubProjectId === boardId).map((p: any) => p.$id);

  let adopted = 0;
  let icur: string | null = null;
  do {
    const q = [Query.limit(100)]; if (icur) q.push(Query.cursorAfter(icur));
    const page: any = await t.listRows(DB, "issues", q);
    for (const issue of page.rows) {
      if (!localIds.includes(issue.projectId) || issue.archivedAt) continue;
      const realItem = realByTitle.get(norm(issue.title));
      if (!realItem) continue;

      // Current mapping — if it points at a draft, delete that draft.
      const mapRes = await t.getRow(DB, "sync_map", issue.$id).catch(() => null as any);
      if (mapRes && mapRes.itemId && mapRes.itemId !== realItem) {
        await gql(`mutation($p:ID!,$i:ID!){ deleteProjectV2Item(input:{projectId:$p,itemId:$i}){ deletedItemId } }`, { p: boardId, i: mapRes.itemId }).catch(() => {});
      }
      // Point the mapping at the real item and set its Status from the DB.
      const now = new Date().toISOString();
      await t.upsertRow(DB, "sync_map", issue.$id, { itemId: realItem, projectId: boardId, rev: 1, createdAt: now, updatedAt: now });
      const optId = optByName.get(norm(stateName.get(issue.stateId) ?? ""));
      if (field && optId) {
        await gql(`mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }`, { p: boardId, i: realItem, f: field.id, o: optId });
      }
      console.log(`adopted "${issue.title}" -> ${realItem} (${stateName.get(issue.stateId)})`);
      adopted++;
    }
    icur = page.rows.length === 100 ? page.rows[page.rows.length - 1].$id : null;
  } while (icur);
  console.log(`\nadopted ${adopted} real board items.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
