// Auto-syncer: on any issues row create/update, mirror the issue to the
// configured GitHub Projects v2 board as a draft item, recording the mapping in
// the sync_map table. Idempotent — an already-mapped issue is left alone.
//
// Runs in Appwrite's cloud, so it uses a stored GitHub token (GITHUB_TOKEN),
// NOT the gh CLI. Dependency-free: talks to Appwrite REST + GitHub GraphQL with
// fetch. Function variables: APPWRITE_API_KEY, APPWRITE_DATABASE_ID,
// GITHUB_TOKEN, GITHUB_PROJECT_ID.

module.exports = async ({ req, res, log, error }) => {
  const {
    APPWRITE_FUNCTION_API_ENDPOINT: ENDPOINT,
    APPWRITE_FUNCTION_PROJECT_ID: PROJECT,
    APPWRITE_API_KEY: KEY,
    APPWRITE_DATABASE_ID: DB,
    GITHUB_TOKEN,
    GITHUB_PROJECT_ID,
  } = process.env;

  const event = req.headers["x-appwrite-event"] || "";
  if (event.includes(".delete")) return res.json({ skipped: "delete" });

  const issue = req.bodyJson;
  if (!issue || !issue.$id) return res.json({ skipped: "no row" });

  const aw = (path, init = {}) =>
    fetch(`${ENDPOINT}/tablesdb/${DB}/tables/${path}`, {
      ...init,
      headers: {
        "X-Appwrite-Project": PROJECT,
        "X-Appwrite-Key": KEY,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

  // Board + token chosen in the UI (settings row "app") win over the env vars.
  let projectId = GITHUB_PROJECT_ID;
  let token = GITHUB_TOKEN;
  const settings = await aw(`settings/rows/app`);
  if (settings.ok) {
    const s = await settings.json();
    if (s.githubProjectId) projectId = s.githubProjectId;
    if (s.githubToken) token = s.githubToken;
  }
  if (!token) {
    error("No GitHub token (settings.app.githubToken or GITHUB_TOKEN)");
    return res.json({ error: "no token" }, 500);
  }
  if (!projectId) {
    error("No GitHub project selected (settings.app or GITHUB_PROJECT_ID)");
    return res.json({ error: "no project" }, 500);
  }

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

  // Already mirrored?
  const existing = await aw(`sync_map/rows/${issue.$id}`);
  if (existing.ok) {
    const row = await existing.json();
    if (row.itemId) return res.json({ ok: true, itemId: row.itemId, action: "exists" });
  }

  const data = await gql(
    `mutation($p: ID!, $t: String!, $b: String) {
      addProjectV2DraftIssue(input: { projectId: $p, title: $t, body: $b }) {
        projectItem { id }
      }
    }`,
    { p: projectId, t: issue.title, b: issue.description || "" }
  );
  const itemId = data.addProjectV2DraftIssue.projectItem.id;

  const now = new Date().toISOString();
  const put = await aw(`sync_map/rows/${issue.$id}`, {
    method: "PUT",
    body: JSON.stringify({
      data: { itemId, projectId, rev: 1, createdAt: now, updatedAt: now },
    }),
  });
  if (!put.ok) {
    error(`sync_map write failed: ${put.status} ${await put.text()}`);
    return res.json({ error: "mapping write failed" }, 500);
  }

  log(`pushed ${issue.key || issue.$id} -> ${itemId}`);
  return res.json({ ok: true, itemId, action: "created" });
};
