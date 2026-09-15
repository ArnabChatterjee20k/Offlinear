// Push the Linear CSV export into Appwrite TablesDB. Idempotent upserts keyed
// by our deterministic ids. Runs from Phase 3.5 onward.
//   pnpm run import -- "path/to/export.csv"
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, TablesDB } from "node-appwrite";
import { mapDataset, type Dataset } from "./lib/parse-csv.js";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID = "offlinear",
} = process.env;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error("Missing Appwrite env vars. See .env.example.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const tdb = new TablesDB(client);
const DB = APPWRITE_DATABASE_ID;

async function upsert(table: string, rows: { id: string }[]) {
  let ok = 0;
  for (const row of rows) {
    const { id, ...data } = row;
    await tdb.upsertRow(DB, table, id, data);
    ok++;
  }
  console.log(`  ${table}: ${ok}`);
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const input = process.argv[2] ?? resolve(root, "arnab@appwrite.io › Assigned issues.csv");
  const data: Dataset = mapDataset(readFileSync(input, "utf8"));

  console.log(`Importing into "${DB}"…`);
  await upsert("teams", data.teams);
  await upsert("states", data.states);
  await upsert("labels", data.labels);
  await upsert("members", data.members);
  await upsert("issues", data.issues);
  console.log("Import complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
