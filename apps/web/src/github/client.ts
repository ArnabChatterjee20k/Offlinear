// Minimal GitHub Projects v2 GraphQL client, called directly from the browser
// with the OAuth provider token (GitHub API allows CORS). This is the
// client-side sync path; a server-side GitHub App can replace it later.
import { githubToken } from "@/auth";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = await githubToken();
  if (!token) throw new Error("Not connected to GitHub");
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  return json.data as T;
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
  status: string | null;
}

/** All items on a project (title + Status single-select value). */
export async function getProjectItems(projectId: string): Promise<GhItem[]> {
  const items: GhItem[] = [];
  let cursor: string | null = null;
  do {
    const data: {
      node: {
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string;
            content: { title?: string } | null;
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
                content { ... on DraftIssue { title } ... on Issue { title } ... on PullRequest { title } }
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
      const status =
        n.fieldValues.nodes.find((f) => "field" in f && f.field?.name === "Status")?.name ?? null;
      items.push({ itemId: n.id, title: n.content?.title ?? "(untitled)", status });
    }
    cursor = data.node.items.pageInfo.hasNextPage ? data.node.items.pageInfo.endCursor : null;
  } while (cursor);
  return items;
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
