// Offlinear fullstack server (Bun): serves the built web app AND the gh-CLI
// bridge API, so the whole thing deploys as one unit.
//   Prod:  WEB_DIST=./dist bun run server.ts   (see Dockerfile)
//   Dev:   bun run server.ts                    (vite serves the UI, proxies /api here)
//
// GitHub access: uses GH_TOKEN if set, else `gh auth token` from a signed-in
// gh CLI. API is mounted under /api/gh.
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 8788);
const here = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = process.env.WEB_DIST
  ? resolve(process.env.WEB_DIST)
  : resolve(here, "../web/dist");

let cachedToken: string | null = null;
let cachedUser: string | null = null;

async function run(cmd: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
  ]);
  return { ok: (await p.exited) === 0, out: out.trim(), err: err.trim() };
}

async function ghToken(): Promise<string> {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (cachedToken) return cachedToken;
  const r = await run(["gh", "auth", "token"]);
  if (!r.ok || !r.out) throw new Error(r.err || "gh is not authenticated. Run: gh auth login");
  cachedToken = r.out;
  return cachedToken;
}

async function ghUser(): Promise<string | null> {
  if (cachedUser) return cachedUser;
  const r = await run(["gh", "api", "user", "--jq", ".login"]);
  cachedUser = r.ok ? r.out : null;
  return cachedUser;
}

function cors(req: Request, extra: Record<string, string> = {}): Headers {
  const h = new Headers(extra);
  h.set("Access-Control-Allow-Origin", req.headers.get("origin") || "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  return h;
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: cors(req, { "Content-Type": "application/json" }),
  });

async function serveStatic(pathname: string): Promise<Response> {
  // Prevent path traversal; fall back to index.html for SPA routes.
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let file = Bun.file(join(WEB_DIST, rel === "/" ? "index.html" : rel));
  if (!(await file.exists())) file = Bun.file(join(WEB_DIST, "index.html"));
  if (!(await file.exists())) return new Response("Build not found", { status: 404 });
  return new Response(file);
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });

    if (url.pathname === "/api/gh/health") {
      try {
        await ghToken();
        return json(req, { ok: true, user: await ghUser() });
      } catch (e) {
        return json(req, { ok: false, error: String((e as Error).message) });
      }
    }

    if (url.pathname === "/api/gh/graphql" && req.method === "POST") {
      try {
        const token = await ghToken();
        const res = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
          body: await req.text(),
        });
        return new Response(await res.text(), {
          status: res.status,
          headers: cors(req, { "Content-Type": "application/json" }),
        });
      } catch (e) {
        return json(req, { errors: [{ message: String((e as Error).message) }] });
      }
    }

    return serveStatic(url.pathname);
  },
});

console.log(`Offlinear server on http://localhost:${PORT} · api /api/gh · dist ${WEB_DIST}`);
