// Minimal GitHub Projects v2 GraphQL client, called directly from the browser
// with the OAuth provider token (GitHub API allows CORS). This is the
// client-side sync path; a server-side GitHub App can replace it later.
import { githubToken } from "@/auth";
import { BRIDGE_URL, getMode } from "./config";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({ query, variables });
  const mode = await getMode();

  let res: Response;
  if (mode === "cli") {
    // The bridge adds the gh-CLI token server-side; the browser sends no token.
    res = await fetch(`${BRIDGE_URL}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } else {
    const token = await githubToken();
    if (!token) throw new Error("Not connected to GitHub");
    res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
      body,
    });
  }

  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  return json.data as T;
}

/** GitHub REST call (for Gists — GraphQL can't create them). Mode-aware:
 *  CLI → the bridge (which adds the gh token); OAuth → api.github.com direct. */
export async function ghRest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const mode = await getMode();
  let res: Response;
  if (mode === "cli") {
    res = await fetch(`${BRIDGE_URL}/rest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, path, body }),
    });
  } else {
    const token = await githubToken();
    if (!token) throw new Error("Not connected to GitHub");
    res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export interface GhProject {
  id: string;
  title: string;
  number: number;
  owner: string;
}

/** The viewer's Projects v2 boards plus those of their orgs. */
export async function listProjects(): Promise<GhProject[]> {
  const data = await gql<{
    viewer: {
      login: string;
      projectsV2: { nodes: { id: string; title: string; number: number }[] };
      organizations: {
        nodes: {
          login: string;
          projectsV2: { nodes: { id: string; title: string; number: number }[] };
        }[];
      };
    };
  }>(`query {
    viewer {
      login
      projectsV2(first: 50) { nodes { id title number } }
      organizations(first: 20) {
        nodes { login projectsV2(first: 50) { nodes { id title number } } }
      }
    }
  }`);
  const out: GhProject[] = [];
  for (const p of data.viewer.projectsV2.nodes)
    out.push({ id: p.id, title: p.title, number: p.number, owner: data.viewer.login });
  for (const org of data.viewer.organizations.nodes)
    for (const p of org.projectsV2.nodes)
      out.push({ id: p.id, title: p.title, number: p.number, owner: org.login });
  return out;
}

export interface GhItem {
  itemId: string;
  title: string;
  body: string;
  status: string | null;
  assignees: string[];
  author: string | null;
}

/** The signed-in GitHub user's login (for filtering imports to your issues). */
export async function getViewerLogin(): Promise<string | null> {
  try {
    const data = await gql<{ viewer: { login: string } }>(`query { viewer { login } }`);
    return data.viewer.login;
  } catch {
    return null;
  }
}

interface Content {
  title?: string;
  body?: string;
  assignees?: { nodes: { login: string }[] };
  author?: { login: string } | null;
  creator?: { login: string } | null;
}

/** All items on a project (title, body, Status, assignees, author). */
export async function getProjectItems(projectId: string): Promise<GhItem[]> {
  const items: GhItem[] = [];
  let cursor: string | null = null;
  const contentFields = `title body assignees(first: 10) { nodes { login } }`;
  do {
    const data: {
      node: {
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string;
            content: Content | null;
            fieldValues: {
              nodes: ({ name?: string; field?: { name?: string } } | Record<string, never>)[];
            };
          }[];
        };
      };
    } = await gql(
      `query($id: ID!, $cursor: String) {
        node(id: $id) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                content {
                  ... on DraftIssue { ${contentFields} creator { login } }
                  ... on Issue { ${contentFields} author { login } }
                  ... on PullRequest { ${contentFields} author { login } }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name field { ... on ProjectV2SingleSelectField { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { id: projectId, cursor }
    );
    for (const n of data.node.items.nodes) {
      const c = n.content ?? {};
      const status =
        n.fieldValues.nodes.find((f) => "field" in f && f.field?.name === "Status")?.name ?? null;
      items.push({
        itemId: n.id,
        title: c.title ?? "(untitled)",
        body: c.body ?? "",
        status,
        assignees: c.assignees?.nodes.map((a) => a.login) ?? [],
        author: c.author?.login ?? c.creator?.login ?? null,
      });
    }
    cursor = data.node.items.pageInfo.hasNextPage ? data.node.items.pageInfo.endCursor : null;
  } while (cursor);
  return items;
}

export interface GhStatusField {
  fieldId: string;
  options: { id: string; name: string }[];
}

/** The project's "Status" single-select field + its options, if present. */
export async function getStatusField(projectId: string): Promise<GhStatusField | null> {
  const data = await gql<{
    node: {
      field: { id: string; options: { id: string; name: string }[] } | null;
    };
  }>(
    `query($id: ID!) {
      node(id: $id) {
        ... on ProjectV2 {
          field(name: "Status") {
            ... on ProjectV2SingleSelectField { id options { id name } }
          }
        }
      }
    }`,
    { id: projectId }
  );
  return data.node.field ? { fieldId: data.node.field.id, options: data.node.field.options } : null;
}

/** Set a project item's Status to the given single-select option. */
export async function setItemStatus(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string
): Promise<void> {
  await gql(
    `mutation($p: ID!, $item: ID!, $field: ID!, $opt: String!) {
      updateProjectV2ItemFieldValue(
        input: { projectId: $p, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $opt } }
      ) { projectV2Item { id } }
    }`,
    { p: projectId, item: itemId, field: fieldId, opt: optionId }
  );
}

/** Create a draft issue on the project; returns the new item id. */
export async function addDraftIssue(projectId: string, title: string, body: string): Promise<string> {
  const data = await gql<{ addProjectV2DraftIssue: { projectItem: { id: string } } }>(
    `mutation($p: ID!, $t: String!, $b: String) {
      addProjectV2DraftIssue(input: { projectId: $p, title: $t, body: $b }) {
        projectItem { id }
      }
    }`,
    { p: projectId, t: title, b: body || "" }
  );
  return data.addProjectV2DraftIssue.projectItem.id;
}
