<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/graph.svg?title=Offlinear&subtitle=Offline-first+kanban+that+mirrors+to+GitHub+Projects&theme=violet&mode=dark" />
    <img alt="Offlinear" src="https://shieldcn.dev/header/graph.svg?title=Offlinear&subtitle=Offline-first+kanban+that+mirrors+to+GitHub+Projects&theme=violet&mode=light" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/ArnabChatterjee20k/Offlinear/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/stars/ArnabChatterjee20k/Offlinear.svg?variant=secondary" /></a>
  <a href="https://github.com/ArnabChatterjee20k/Offlinear/network/members"><img alt="GitHub forks" src="https://shieldcn.dev/github/forks/ArnabChatterjee20k/Offlinear.svg?variant=secondary" /></a>
  <a href="https://github.com/ArnabChatterjee20k/Offlinear/issues"><img alt="GitHub issues" src="https://shieldcn.dev/github/issues/ArnabChatterjee20k/Offlinear.svg?variant=secondary" /></a>
  <a href="https://github.com/ArnabChatterjee20k/Offlinear/commits"><img alt="Last commit" src="https://shieldcn.dev/github/last-commit/ArnabChatterjee20k/Offlinear.svg?variant=secondary" /></a>
</p>

Offlinear is a kanban board that works offline. It keeps its data in Appwrite TablesDB and mirrors that data one way into GitHub Projects v2. Every edit lands in a local IndexedDB store first, so the board never waits on the network, then syncs to Appwrite and flows out to GitHub.

## Why it exists

GitHub Projects holds the data but the editing experience is slow. Linear has a good editing experience but keeps your data to itself. Offlinear aims for a Linear-style board with local-first speed, while GitHub stays a readable mirror of the same work.

## What it does today

- **Offline-first board.** Each change is an operation appended to a local outbox and applied right away. The sync engine drains the outbox to Appwrite when you are online and pulls changes back over Appwrite Realtime.
- **Appwrite is the source of truth.** TablesDB holds issues, states, labels, members, comments, projects, and reports. GitHub is downstream, so an Appwrite change always wins.
- **One-way GitHub Projects v2 mirror.** An Appwrite Function pushes issues to a chosen project board as draft items, sets their Status, and runs a daily reconcile that repairs any drift. It also adopts an existing board item by title instead of creating a duplicate.
- **Two GitHub connection modes.** Connect through GitHub OAuth in the browser, or run the bundled Bun server and let it use your local `gh` CLI token. The web app talks to the same bridge either way.
- **Reports with a rich editor.** Write reports in a TipTap editor that stores markdown, renders mermaid diagrams in preview, and publishes to a private GitHub Gist with conflict-aware sync.
- **PRs dashboard.** See your open pull requests across every repo and org, grouped by repo, org, or date, with fuzzy search, multi-select, copy-as-markdown-links, and close from the list.
- **Keyboard-first UX.** A command palette and single-key actions drive the board without a mouse.

The agent layer (Claude Code as a runtime driven by Appwrite signals) is designed but not built yet. See [plan.md](./plan.md) for that design and the full roadmap.

## How it fits together

```
Browser (React + Dexie)  ->  Appwrite TablesDB (source of truth)  ->  GitHub Projects v2 (mirror)
        local outbox              Realtime sync + Functions               draft items + Status
```

The web app writes to a local Dexie store and an outbox, then syncs to Appwrite. An Appwrite Function mirrors issue changes to a GitHub project board. The Bun server (`apps/server`) serves the built web app and proxies GitHub requests through the `gh` CLI at `/api/gh`.

## Repository layout

```
apps/web/                React + TypeScript + Dexie board, reports, PRs dashboard
apps/server/             Bun fullstack server: serves the web build + a gh CLI bridge
packages/shared/         entity types and shared code
functions/push-to-github/  Appwrite Function that mirrors issues to GitHub Projects v2
scripts/                 TablesDB schema-as-code, CSV import, function deploy, board repair
```

## Getting started

You need Node, pnpm, and an Appwrite project (Cloud or self-hosted). For the `gh` CLI mode and the PRs dashboard you also need the GitHub CLI signed in (`gh auth login`).

```bash
# 1. Install
pnpm install

# 2. Configure Appwrite credentials
cp .env.example .env      # set endpoint, project id, API key, database id

# 3. Create the TablesDB schema (tables, columns, indexes, storage bucket)
pnpm run schema:push

# 4. Optional: import a Linear CSV export
pnpm run import -- "path/to/export.csv"

# 5a. Run the web app in dev
pnpm dev

# 5b. Or build and serve the fullstack app (web + gh bridge) with Bun
pnpm build && pnpm serve
```

## Deploy the sync function

The GitHub mirror runs as an Appwrite Function. Deploy it with:

```bash
pnpm run deploy:functions
```

It runs on `issues` row events and on a daily schedule. It reads the GitHub token from `settings.app.githubToken` (set in the app UI) or the `GITHUB_TOKEN` function variable, and pushes to the project board chosen per Offlinear project.

## Maintenance scripts

The `scripts/` folder has one-off tools for the GitHub board:

- `gh-resync.ts` rebuilds a board from the database (removes duplicate drafts, recreates one item per issue).
- `gh-adopt-real.ts` maps existing real GitHub issues to their database rows by title.
- `gh-repair-bodies.ts` repushes descriptions that never reached the board.

## Tech stack

React 18, TypeScript, Dexie (IndexedDB), Tailwind with shadcn/ui, and TipTap for the editor. Appwrite provides TablesDB, Realtime, Storage, and Functions. The GitHub mirror uses the Projects v2 GraphQL API. The Bun server serves the app and bridges the `gh` CLI.

## Roadmap

The original design document, including the offline write model, the reconciliation rules, and the planned agent layer, now lives in [plan.md](./plan.md).

## License

Not yet decided.
