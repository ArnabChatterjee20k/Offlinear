// Generate apps/web/public/seed.json from the Linear CSV export so the web app
// boots with real data and no backend. Usage:
//   pnpm run seed -- "path/to/export.csv"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mapDataset } from "./lib/parse-csv.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const input =
  process.argv[2] ??
  resolve(root, "arnab@appwrite.io › Assigned issues.csv");
const outPath = resolve(root, "apps/web/public/seed.json");

const csv = readFileSync(input, "utf8");
const data = mapDataset(csv);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data));

console.log(
  `seed.json → ${outPath}\n  ${data.issues.length} issues · ${data.members.length} members · ${data.teams.length} teams · ${data.labels.length} labels · ${data.states.length} states`
);
