// Push the Linear CSV export into Appwrite TablesDB (Databases API). Idempotent
// upserts keyed by our deterministic ids. Runs from Phase 3.5 onward.
//   pnpm run import -- "path/to/export.csv"
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client, Databases } from "node-appwrite";
import { mapDataset, type Dataset } from "./lib/parse-csv.js";

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
const db = new Databases(client);
const DB = APPWRITE_DATABASE_ID;

async function upsert(collection: string, rows: { id: string }[]) {
  let ok = 0;
  for (const row of rows) {
    const { id, ...data } = row;
    try {
      await db.createDocument(DB, collection, id, data);
    } catch (e: any) {
      if (e?.code === 409) await db.updateDocument(DB, collection, id, data);
      else throw e;
    }
    ok++;
  }
  console.log(`  ${collection}: ${ok}`);
}

async function main() {
  const input =
    process.argv[2] ??
    resolve(process.cwd(), "arnab@appwrite.io › Assigned issues.csv");
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
