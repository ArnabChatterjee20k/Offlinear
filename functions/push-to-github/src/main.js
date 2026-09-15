// GitHub auto-syncer. Two entry points:
//   • Event (issues row create/update): mirror that one issue.
//   • Schedule (daily): scan all issues and mirror any not yet on GitHub.
//
// Runs in Appwrite's cloud → uses a stored GitHub token (GITHUB_TOKEN or
// settings.app.githubToken), NOT the gh CLI. The board comes from each issue's
// project (projects.{id}.githubProjectId). Dependency-free (fetch only).

function makeClient({ endpoint, project, key, token }) {
  const aw = (path, init = {}) =>
    fetch(`${endpoint}/tablesdb/${path}`, {
      ...init,
      headers: {
        "X-Appwrite-Project": project,
        "X-Appwrite-Key": key,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

  const gql = async (query, variables) => {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json();
    if (j.errors) throw new Error(j.errors.map((e) => e.message).join("; "));
    return j.data;
  };

  return { aw, gql };
}

const norm = (s) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();

/** Mirror one issue to its project's GitHub board. Idempotent. */
async function syncIssue(issue, { aw, gql, db, log }) {
  if (!issue || !issue.$id) return { skipped: "no row" };

  const existing = await aw(`${db}/tables/sync_map/rows/${issue.$id}`);
  if (existing.ok) {
    const row = await existing.json();
    if (row.itemId) return { action: "exists" };
  }

  if (!issue.projectId) return { skipped: "no project" };
  const projRes = await aw(`${db}/tables/projects/rows/${issue.projectId}`);
  const projectId = projRes.ok ? (await projRes.json()).githubProjectId : null;
  if (!projectId) return { skipped: "project not linked" };

  const data = await gql(
    `mutation($p: ID!, $t: String!, $b: String) {
      addProjectV2DraftIssue(input: { projectId: $p, title: $t, body: $b }) { projectItem { id } }
    }`,
    { p: projectId, t: issue.title, b: issue.description || "" }
  );
  const itemId = data.addProjectV2DraftIssue.projectItem.id;

  // Set the item's Status to match the issue's state column.
  try {
    const stRes = await aw(`${db}/tables/states/rows/${issue.stateId}`);
    const stateName = stRes.ok ? (await stRes.json()).name : null;
    if (stateName) {
      const fd = await gql(
        `query($id: ID!) { node(id: $id) { ... on ProjectV2 {
          field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } } } } }`,
        { id: projectId }
      );
      const field = fd.node && fd.node.field;
      const opt = field && field.options.find((o) => norm(o.name) === norm(stateName));
      if (opt) {
        await gql(
          `mutation($p: ID!, $i: ID!, $f: ID!, $o: String!) {
            updateProjectV2ItemFieldValue(input: { projectId: $p, itemId: $i, fieldId: $f, value: { singleSelectOptionId: $o } }) { projectV2Item { id } }
          }`,
          { p: projectId, i: itemId, f: field.id, o: opt.id }
        );
      }
    }
  } catch (e) {
    log(`status set skipped: ${e.message}`);
  }

  const now = new Date().toISOString();
  await aw(`${db}/tables/sync_map/rows/${issue.$id}`, {
    method: "PUT",
    body: JSON.stringify({ data: { itemId, projectId, rev: 1, createdAt: now, updatedAt: now } }),
  });
  log(`pushed ${issue.key || issue.$id} -> ${itemId}`);
  return { action: "created", itemId };
}

module.exports = async ({ req, res, log, error }) => {
  const {
    APPWRITE_FUNCTION_API_ENDPOINT: endpoint,
    APPWRITE_FUNCTION_PROJECT_ID: project,
    APPWRITE_API_KEY: key,
    APPWRITE_DATABASE_ID: db,
    GITHUB_TOKEN,
  } = process.env;

  // Token: settings.app.githubToken (global) overrides the env var.
  let token = GITHUB_TOKEN;
  const base = makeClient({ endpoint, project, key, token: token || "" });
  const settings = await base.aw(`${db}/tables/settings/rows/app`);
  if (settings.ok) {
    const s = await settings.json();
    if (s.githubToken) token = s.githubToken;
  }
  if (!token) {
    error("No GitHub token (settings.app.githubToken or GITHUB_TOKEN)");
    return res.json({ error: "no token" }, 500);
  }
  const { aw, gql } = makeClient({ endpoint, project, key, token });
  const ctx = { aw, gql, db, log };

  const event = req.headers["x-appwrite-event"] || "";

  // Event trigger → sync the single changed issue.
  if (event) {
    if (event.includes(".delete")) return res.json({ skipped: "delete" });
    return res.json(await syncIssue(req.bodyJson, ctx));
  }

  // Scheduled run → reconcile: push any issues not yet on GitHub.
  let cursor = null;
  let created = 0;
  let scanned = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const queries = [JSON.stringify({ method: "limit", values: [100] })];
    if (cursor) queries.push(JSON.stringify({ method: "cursorAfter", values: [cursor] }));
    const qs = queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join("&");
    const page = await aw(`${db}/tables/issues/rows?${qs}`);
    if (!page.ok) {
      error(`list issues failed: ${page.status}`);
      break;
    }
    const { rows } = await page.json();
    for (const issue of rows) {
      scanned++;
      const r = await syncIssue(issue, ctx);
      if (r.action === "created") created++;
    }
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].$id;
  }
  log(`reconcile: scanned ${scanned}, created ${created}`);
  return res.json({ ok: true, scanned, created });
};
