import { OAuthProvider, type Models } from "appwrite";
import { DATABASE_ID, account, tablesDB } from "./sync/appwrite-config";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);

/** Stable member id derived from email (matches the CSV importer's scheme). */
export const memberIdFor = (email: string, fallback: string) =>
  `user_${slug(email || fallback)}`;

/** The signed-in Appwrite account, or null if there's no session. */
export async function currentAccount(): Promise<Models.User<Models.Preferences> | null> {
  if (!account) return null;
  try {
    return await account.get();
  } catch {
    return null;
  }
}

/** Redirect to GitHub OAuth. On return the browser lands back on the app. */
export function loginWithGitHub(): void {
  const url = window.location.origin + window.location.pathname;
  account?.createOAuth2Session(OAuthProvider.Github, url, url, ["read:user", "user:email"]);
}

export async function logout(): Promise<void> {
  try {
    await account?.deleteSession("current");
  } catch {
    /* already gone */
  }
}

/**
 * Ensure a `members` row exists for the signed-in user and return its id.
 * Upserts to Appwrite so ops attributed to this user resolve everywhere.
 */
export async function ensureMember(
  user: Models.User<Models.Preferences>
): Promise<string> {
  const id = memberIdFor(user.email, user.$id);
  const now = new Date().toISOString();
  const data = {
    name: user.name || user.email?.split("@")[0] || "Me",
    email: user.email || "",
    avatar: null as string | null,
    githubLogin: null as string | null, // filled from the GitHub API in Phase 3.5
    isAgent: false,
    rev: 1,
    createdAt: now,
    updatedAt: now,
  };
  // upsertRow creates or replaces — idempotent for repeat logins.
  await tablesDB!.upsertRow(DATABASE_ID, "members", id, data);
  return id;
}
