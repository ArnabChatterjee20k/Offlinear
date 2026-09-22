// Deploy the Appwrite Functions (currently: push-to-github auto-syncer).
// Needs an API key with functions.read/write + the database scopes.
//   GITHUB_PROJECT_ID=PVT_... pnpm run deploy:functions
import { config } from "dotenv";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Functions, Runtime } from "node-appwrite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID = "offlinear",
  GITHUB_PROJECT_ID,
} = process.env;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error("Missing Appwrite env vars. See .env.example.");
  process.exit(1);
}
// GITHUB_PROJECT_ID is optional — the app writes the chosen board to the
// settings row, which the function prefers.

// Optional: the token can instead be entered in the app UI (stored in the
// settings row, which the function prefers). Seed the env var if we have one.
let githubToken = process.env.GITHUB_TOKEN ?? "";
if (!githubToken) {
  try {
    githubToken = execSync("gh auth token").toString().trim();
  } catch {
    /* none — the function will use settings.githubToken instead */
  }
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const fns = new Functions(client);

const FN = "push-to-github";
const events = [
  `databases.${APPWRITE_DATABASE_ID}.tables.issues.rows.*.create`,
  `databases.${APPWRITE_DATABASE_ID}.tables.issues.rows.*.update`,
];
// Daily reconcile sweep (03:00 UTC): push any issues not yet on GitHub.
const SCHEDULE = process.env.SYNC_SCHEDULE ?? "0 3 * * *";
// The daily reconcile repairs drift across every mapped issue (draft body/title
// + status), so it needs more than the 15s default.
const TIMEOUT = Number(process.env.SYNC_TIMEOUT ?? 300);

const variables: Record<string, string> = {
  APPWRITE_API_KEY: APPWRITE_API_KEY!,
  APPWRITE_DATABASE_ID: APPWRITE_DATABASE_ID!,
  ...(GITHUB_PROJECT_ID ? { GITHUB_PROJECT_ID } : {}),
  ...(githubToken ? { GITHUB_TOKEN: githubToken } : {}),
};

async function main() {
  console.log(`Deploying function "${FN}"…`);

  try {
    await fns.create(
      FN,
      FN,
      Runtime.Node22,
      undefined,
      events,
      SCHEDULE,
      TIMEOUT,
      true,
      true,
      "src/main.js",
      "npm install"
    );
    console.log("  + created function");
  } catch (e: any) {
    if (e?.code === 409) {
      await fns.update(FN, FN, Runtime.Node22, undefined, events, SCHEDULE, TIMEOUT, true, true, "src/main.js", "npm install");
      console.log("  = function exists (events updated)");
    } else throw e;
  }

  for (const [key, value] of Object.entries(variables)) {
    try {
      await fns.createVariable(FN, key, key, value, true);
    } catch (e: any) {
      if (e?.code === 409) {
        const list = await fns.listVariables(FN);
        const existing = list.variables.find((v: any) => v.key === key);
        if (existing) await fns.updateVariable(FN, existing.$id, key, value, true);
      } else throw e;
    }
    console.log(`  · variable ${key}`);
  }

  // Tar the function source; Appwrite runs `npm install` during build.
  const tar = resolve(root, "functions/push-to-github.tar.gz");
  execSync(`tar -czf ${tar} -C functions/push-to-github .`, { cwd: root });
  const file = new File([readFileSync(tar)], "code.tar.gz", { type: "application/gzip" });

  console.log("  … uploading deployment (this triggers a build)");
  const dep = await fns.createDeployment(FN, file, true, "src/main.js", "npm install");
  console.log(`  + deployment ${dep.$id} (${dep.status})`);
  console.log("Done. Watch build logs in the Appwrite console → Functions.");
}

main().catch((e) => {
  console.error(e?.response ?? e);
  process.exit(1);
});
