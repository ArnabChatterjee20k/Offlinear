// Repair drift: for every mapped DRAFT whose GitHub body/title differs from the
// DB issue, push the current title/description. Fixes descriptions that never
// made it onto the board (e.g. added after the draft was first created).
//   pnpm --filter @offlinear/scripts exec tsx gh-repair-bodies.ts
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, TablesDB, Query } from "node-appwrite";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env") });
const DB = process.env.APPWRITE_DATABASE_ID!;
const c = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const t = new TablesDB(c);
const norm = (s: string) => (s ?? "").replace(/\r\n/g, "\n").replace(/\s+$/g, "").trim();

async function main() {
  const s: any = await t.getRow(DB, "settings", "app");
  const token = s.githubToken;
  const gql = async (q: string, v: any = {}) => {
    const r = await fetch("https://api.github.com/graphql", { method: "POST", headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q, variables: v }) });
    const j: any = await r.json();
    if (j.errors) throw new Error(j.errors.map((e: any) => e.message).join("; "));
    return j.data;
  };

  const issues: any = await t.listRows(DB, "issues", [Query.limit(200)]);
  let fixed = 0, skipped = 0;
  for (const i of issues.rows) {
    const m: any = await t.getRow(DB, "sync_map", i.$id).catch(() => null);
    if (!m?.itemId) continue;
    const d: any = await gql(`query($id:ID!){ node(id:$id){ ... on ProjectV2Item { content { __typename ... on DraftIssue{ id title body } } } } }`, { id: m.itemId });
    const content = d.node?.content;
    if (content?.__typename !== "DraftIssue") { skipped++; continue; } // real issue body can't be edited this way
    if (norm(content.body) === norm(i.description) && content.title === i.title) continue; // already in sync
    await gql(
      `mutation($d:ID!,$t:String!,$b:String){ updateProjectV2DraftIssue(input:{draftIssueId:$d,title:$t,body:$b}){ draftIssue{ id } } }`,
      { d: content.id, t: i.title, b: i.description || "" }
    );
    console.log(`fixed #${i.key} "${i.title.slice(0,40)}" (body ${norm(content.body).length} -> ${norm(i.description).length})`);
    fixed++;
  }
  console.log(`\nrepaired ${fixed} drafts (${skipped} real issues skipped).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
