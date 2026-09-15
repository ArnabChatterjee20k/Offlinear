import { Account, Client, Databases } from "appwrite";

// Read from Vite env (apps/web/.env). The API key is NEVER used in the browser;
// the client authenticates with an (anonymous) session and relies on collection
// permissions (Role.users()).
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined;
export const DATABASE_ID =
  (import.meta.env.VITE_APPWRITE_DATABASE_ID as string | undefined) ?? "offlinear";

/** True when the app is configured to use Appwrite as the source of truth. */
export const appwriteConfigured = Boolean(endpoint && projectId);

export const client = appwriteConfigured
  ? new Client().setEndpoint(endpoint!).setProject(projectId!)
  : null;

export const databases = client ? new Databases(client) : null;
export const account = client ? new Account(client) : null;
