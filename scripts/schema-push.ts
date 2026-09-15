// Schema-as-code for Appwrite TablesDB. Idempotently creates the database,
// tables, columns, and indexes. Runs from Phase 3.5 onward; needs .env creds.
//   pnpm run schema:push
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, TablesDB, TablesDBIndexType, Permission, Role } from "node-appwrite";

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

type Attr =
  | { name: string; kind: "string"; size: number; required?: boolean; array?: boolean }
  | { name: string; kind: "int" | "float"; required?: boolean }
  | { name: string; kind: "bool"; required?: boolean }
  | { name: string; kind: "datetime"; required?: boolean }
  | { name: string; kind: "enum"; elements: string[]; required?: boolean };

interface Table {
  id: string;
  attrs: Attr[];
  indexes?: { key: string; attrs: string[]; type?: TablesDBIndexType }[];
}

// Server columns (rev/createdAt/updatedAt) are appended to every table.
const SERVER: Attr[] = [
  { name: "rev", kind: "int", required: true },
  { name: "createdAt", kind: "datetime", required: true },
  { name: "updatedAt", kind: "datetime", required: true },
];

const TABLES: Table[] = [
  { id: "teams", attrs: [{ name: "key", kind: "string", size: 8, required: true }, { name: "name", kind: "string", size: 128, required: true }] },
  {
    id: "states",
    attrs: [
      { name: "teamId", kind: "string", size: 64 },
      { name: "name", kind: "string", size: 64, required: true },
      { name: "type", kind: "enum", elements: ["backlog", "unstarted", "started", "completed", "canceled"], required: true },
      { name: "color", kind: "string", size: 16 },
      { name: "position", kind: "float", required: true },
      { name: "githubOptionId", kind: "string", size: 64 },
    ],
  },
  { id: "labels", attrs: [{ name: "teamId", kind: "string", size: 64 }, { name: "name", kind: "string", size: 64, required: true }, { name: "color", kind: "string", size: 16 }] },
  {
    id: "members",
    attrs: [
      { name: "name", kind: "string", size: 128, required: true },
      { name: "email", kind: "string", size: 256, required: true },
      { name: "avatar", kind: "string", size: 512 },
      { name: "githubLogin", kind: "string", size: 64 },
      { name: "isAgent", kind: "bool", required: true },
    ],
    indexes: [{ key: "email", attrs: ["email"] }],
  },
  {
    id: "issues",
    attrs: [
      { name: "key", kind: "string", size: 32, required: true },
      { name: "teamId", kind: "string", size: 64 },
      { name: "title", kind: "string", size: 512, required: true },
      { name: "description", kind: "string", size: 100000 },
      { name: "stateId", kind: "string", size: 64, required: true },
      { name: "priority", kind: "int", required: true },
      { name: "estimate", kind: "float" },
      { name: "assigneeId", kind: "string", size: 64 },
      { name: "creatorId", kind: "string", size: 64 },
      { name: "labelIds", kind: "string", size: 64, array: true },
      { name: "dueDate", kind: "datetime" },
      { name: "parentId", kind: "string", size: 64 },
      { name: "relatedIds", kind: "string", size: 64, array: true },
      { name: "blockedByIds", kind: "string", size: 64, array: true },
      { name: "duplicateOfId", kind: "string", size: 64 },
      { name: "boardOrder", kind: "float", required: true },
      { name: "startedAt", kind: "datetime" },
      { name: "completedAt", kind: "datetime" },
      { name: "canceledAt", kind: "datetime" },
      { name: "archivedAt", kind: "datetime" },
    ],
    indexes: [
      { key: "key", attrs: ["key"], type: TablesDBIndexType.Unique },
      { key: "stateId", attrs: ["stateId"] },
      { key: "updatedAt", attrs: ["updatedAt"] },
    ],
  },
  {
    id: "comments",
    attrs: [
      { name: "issueId", kind: "string", size: 64, required: true },
      { name: "authorId", kind: "string", size: 64 },
      { name: "body", kind: "string", size: 50000, required: true },
      { name: "source", kind: "enum", elements: ["human", "agent"], required: true },
    ],
    indexes: [{ key: "issueId", attrs: ["issueId"] }],
  },
];

const ignore409 = async (p: Promise<unknown>, label: string) => {
  try {
    await p;
    console.log("  +", label);
  } catch (e: any) {
    if (e?.code === 409) console.log("  =", label, "(exists)");
    else throw e;
  }
};

async function createColumn(table: string, a: Attr) {
  const req = "required" in a ? !!a.required : false;
  const arr = "array" in a ? !!a.array : false;
  switch (a.kind) {
    case "string":
      return tdb.createStringColumn(DB, table, a.name, a.size, req, undefined, arr);
    case "int":
      return tdb.createIntegerColumn(DB, table, a.name, req, undefined, undefined, undefined, arr);
    case "float":
      return tdb.createFloatColumn(DB, table, a.name, req, undefined, undefined, undefined, arr);
    case "bool":
      return tdb.createBooleanColumn(DB, table, a.name, req, undefined, arr);
    case "datetime":
      return tdb.createDatetimeColumn(DB, table, a.name, req, undefined, arr);
    case "enum":
      return tdb.createEnumColumn(DB, table, a.name, a.elements, req, undefined, arr);
  }
}

async function main() {
  console.log(`Pushing schema to database "${DB}"…`);
  await ignore409(tdb.create(DB, "Offlinear"), `database ${DB}`);

  for (const table of TABLES) {
    await ignore409(
      tdb.createTable(DB, table.id, table.id, [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]),
      `table ${table.id}`
    );
    for (const a of [...table.attrs, ...SERVER]) {
      await ignore409(createColumn(table.id, a), `${table.id}.${a.name}`);
    }
    // Columns must be available before indexes; Appwrite processes async.
    for (const idx of table.indexes ?? []) {
      await ignore409(
        tdb.createIndex(DB, table.id, idx.key, idx.type ?? TablesDBIndexType.Key, idx.attrs),
        `${table.id} idx ${idx.key}`
      );
    }
  }
  console.log("Schema push complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
