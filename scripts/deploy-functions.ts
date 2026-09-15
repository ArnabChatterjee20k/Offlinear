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
if (!GITHUB_PROJECT_ID) {
  console.error("Set GITHUB_PROJECT_ID (the Projects v2 node id, e.g. PVT_...).");
  process.exit(1);
}

const githubToken = (process.env.GITHUB_TOKEN || execSync("gh auth token").toString()).trim();
if (!githubToken) {
  console.error("No GitHub token (set GITHUB_TOKEN or run `gh auth login`).");
  process.exit(1);
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

const variables: Record<string, string> = {
  APPWRITE_API_KEY: APPWRITE_API_KEY!,
  APPWRITE_DATABASE_ID: APPWRITE_DATABASE_ID!,
  GITHUB_TOKEN: githubToken,
  GITHUB_PROJECT_ID: GITHUB_PROJECT_ID!,
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
      undefined,
      15,
      true,
      true,
      "src/main.js",
      "npm install"
    );
    console.log("  + created function");
  } catch (e: any) {
    if (e?.code === 409) {
      await fns.update(FN, FN, Runtime.Node22, undefined, events, undefined, 15, true, true, "src/main.js", "npm install");
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
