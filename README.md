# Offlinear

An offline-first, Linear-style kanban board that treats **Appwrite as the source of truth** and **mirrors one-way into GitHub Projects v2** — with a first-class agent layer where **Claude Code is the runtime**. Every edit hits a local store instantly, syncs to Appwrite, and flows out to GitHub. Tag an agent on a card (or on the linked GitHub thread) and, with autopilot on, Claude Code picks up the signal and acts.

> Status: **planning / pre-Phase-0.** This README is the design contract we build against.

---

## Why

GitHub Projects has the data but a mediocre editing experience. Linear has the UX but is a silo. Offlinear aims for **Linear's feel, local-first speed, and GitHub as a mirror** — plus deep, opt-in agent automation that runs on your own machine instead of a sandbox.

## Principles

- **Local-first.** Every mutation is applied optimistically to a local IndexedDB store, then synced. The UI never blocks on the network.
- **One source of truth.** Appwrite (TablesDB) is authoritative. GitHub Projects v2 is a downstream mirror.
- **One executor, many front-ends.** The UI, the command palette, and agents all emit the *same* operations. No path forks its own write logic.
- **Agents act like humans.** Agent actions are ordinary ops — optimistic, audited, reversible, and mirrored to GitHub for free.
- **Cloud coordinates, your machine computes.** Appwrite emits *signals*; Claude Code (locally) does the thinking and acting. No LLM runs in the cloud.

---

## Architecture

```
┌─────────────── Browser (React + TS) ──────────────────────┐
│  UI (board, issue panel, ⌘K palette)                       │
│      │ optimistic write                                    │
│  Local store (IndexedDB via Dexie)                         │
│   ├─ entity tables (issues, states, labels, comments…)     │
│   └─ outbox (ordered op log w/ base revision)              │
│      │ drain when online          ▲ realtime + delta pull  │
└──────┼────────────────────────────┼───────────────────────┘
       ▼ Appwrite SDK               │ Appwrite Realtime
┌──────────────── Appwrite (source of truth) ───────────────┐
│  TablesDB: issues, states, labels, comments, members,     │
│            sync_map, sync_ops, agent_signals, agents       │
│  Realtime: row events + presence channels                 │
│  Functions (thin, no LLM):                                 │
│   • board-dispatch   (board event → agent_signals)         │
│   • github-webhook   (GitHub comment → agent_signals)      │
│   • reconcile-cron   (drift sweep vs GitHub)               │
└──────┬───────────────────────────────────┬────────────────┘
       ▼ GraphQL (GitHub App)               │ signals (WS/poll)
┌──── GitHub Projects v2 ────┐   ┌──── Local: Claude Code ───────────┐
│  Board items, Status,      │   │  Offlinear MCP server (stdio)     │
│  linked issues, comments   │◄──┤   next_signal / get_context /     │
└────────────────────────────┘   │   comment / move_issue / …        │
             ▲ signals            │  Claude Code = the agent runtime  │
   MQTT topics (Appwrite Push) ──►│  (manual, or a scheduled loop)    │
   + agent_signals ledger         └───────────────────────────────────┘
```

### The write model (offline + reconciliation)

- Every user action becomes an **operation**: `{ opId, entity, entityId, type, patch, baseRev, createdAt }`, appended to an IndexedDB **outbox** and applied optimistically.
- Each entity row carries a server-assigned monotonic **`rev`** + `updatedAt`. Ops carry the `baseRev` they were built on.
- The sync engine drains the outbox in order when online. The server applies an op only if `baseRev` still matches (**optimistic concurrency**); on mismatch the client **re-bases** using **field-level last-write-wins** (per-field `updatedAt`), so edits to different fields don't clobber.
- **Pull:** Appwrite Realtime for live updates while connected; a **delta pull** on reconnect (via a `syncCursor`) catches anything missed offline.
- Because GitHub is a *mirror*, GitHub↔Appwrite conflicts always resolve in Appwrite's favor. `reconcile-cron` repushes drift.

### Agent execution model

The cloud never runs an agent. It only writes **signals**; **Claude Code** pulls and acts through an MCP server.

```
Interaction (mention / assign-to-bot / label / state move / GitHub comment)
  → op committed to Appwrite
  → board-dispatch / github-webhook Fn writes an agent_signals row
  → Offlinear MCP server surfaces it to Claude Code (next_signal)
  → Claude Code loads context, acts via op tools (comment/move/link/reply_github)
  → results sync to Appwrite → mirror to GitHub
```

- **Signals are durable + offline-first for agents too:** if no runtime is online, they queue and drain later.
- **Claim/lease** on each signal (rev-CAS) so two machines don't double-act.
- **Autopilot toggle**, three layers, any one pauses it:
  - **Cloud** — per-agent `autopilot { enabled, until }` TTL (dispatcher stops emitting).
  - **Runtime** — start/stop the scheduled `/loop` (loop on = autopilot on).
  - **Local safety** — MCP tool scopes (e.g. comment + move, but not delete).
- **GitHub-comment trigger:** comment on a linked GitHub thread where the mapped issue's assignee is a bot agent → `github-webhook` Fn writes a signal → Claude Code replies on the thread and/or updates the board. Your machine only ever makes **outbound** connections.

### Waking Claude Code on an event (token-friendly)

**The model never waits.** A tiny non-LLM listener (`offlinear-listen`, part of `packages/mcp`) holds the Appwrite Realtime subscription and costs **zero tokens while idle**. Only when a signal arrives — debounced ~5s to batch a burst — does it spawn Claude Code, with the context pre-assembled so the model doesn't spend turns exploring.

```
Appwrite agent_signals ──WS──► offlinear-listen  (no LLM; idle = 0 tokens)
                                   │  debounce ~5s to batch a burst
                                   ▼
                          spawn headless Claude Code:
                          ├─ hot issue (recent session)? → claude --resume <sid>
                          └─ else                        → claude -p  + get_context()
```

Why headless one-shot over a `/loop` or frequent cron: a loop/cron pays the full context load **on every tick, even when idle**, while a listener-triggered one-shot pays **only when there's work**. Cost is further bounded with `--max-turns`, scoped `--allowedTools`, and a cheap `--model` (Haiku) triage pass that escalates only when needed. Switch to a single warm session woken by an external trigger *only* if signals turn out to arrive every few minutes (keeps the ~1h prompt cache warm).

### Signal transport — MQTT topics (Appwrite Push)

Signals ride **MQTT** (via Appwrite Push, which exposes MQTT semantics); Appwrite Realtime WS is the fallback. MQTT is purpose-built for this bus:

- **QoS 1 (at-least-once) + persistent sessions** → durable, offline-first delivery *natively*: a subscriber that was offline receives its queued signals on reconnect, no table-polling. Our existing `opId`/signal-id **idempotency** makes at-least-once safe (no need for QoS 2).
- **Retained messages** hold current state per topic (e.g. the autopilot toggle) so a fresh subscriber knows it immediately.
- **Last-Will-and-Testament** gives agent-runtime presence (online/offline) for free.
- **Outbound-only** — the MQTT client dials the broker; the machine needs no inbound port.

**Topic scheme:**

```
offlinear/agent/{handle}/signal      # dispatcher → agent   (offlinear-listen subscribes; QoS 1)
offlinear/agent/{handle}/autopilot   # retained: { enabled, until }
offlinear/agent/{handle}/presence    # retained + LWT: online / offline
offlinear/issue/{key}/activity       # agent → board/UI: live task status
offlinear/reply/{correlationId}      # request/reply: the result of a signal
```

**Request/reply (result path):** each signal carries `correlationId` + `replyTo`. When the agent finishes it publishes the outcome to `offlinear/reply/{correlationId}`; the dispatcher — the UI showing "Claude is working…", or **another agent that chained this one** — is subscribed there and receives the result. This is what enables agent-to-agent handoffs over the bus.

**MQTT is transport, the table is the ledger.** The dispatcher writes the `agent_signals` row **and** publishes to the topic. The subscriber still **claims via rev-CAS** against the row (two machines can't double-act) and, on reconnect, reconciles against the table as a no-loss backstop. MQTT gives low-latency push; `agent_signals` gives audit + claim/lease + durability.

### Agent memory — context is re-hydrated, not remembered

A headless session is disposable cache; **the context lives in Appwrite and is reconstructed every run.** A fresh session that calls `get_context(issueKey)` is *more current* than a long-lived one holding stale history. Two kinds of context, preserved differently:

- **Domain context** — issue, full comment thread (incl. prior agent comments marked `source: agent`), relation graph, and the triggering event. Never held in a session; `get_context` returns it in one call.
- **Reasoning continuity** — the agent's own "tried X, ruled out Y, waiting on Z." Preserved two ways:
  - **Durable worklog (robust):** every agent run *ends* by writing an `agent_worklog` op on the issue — actions taken, decisions, open questions, next step. `get_context` returns it, so any cold session — even on another machine or another model — resumes the reasoning. Model-agnostic and machine-agnostic.
  - **Per-issue session resume (cheap/fast):** the MCP server keeps an `issueKey → claudeSessionId` map and uses `claude --resume` for a *hot* issue (cache-warm, full transcript). Because the transcript grows unbounded, it's **capped** — after N turns or ~1h it drops to a cold `claude -p` + `get_context()` rehydrate. The worklog means the reset loses almost nothing.

This is strictly better than a long-lived session: always fresh, shared across machines (worklog in Appwrite), portable across models, and token-bounded (no ever-growing transcript).

---

## Data model (Appwrite TablesDB)

| Table | Purpose |
|---|---|
| `members` | id, name, email, avatar, githubLogin, `isAgent` |
| `teams` | id, key (`DAT`), name |
| `states` | id, teamId, name, type, position, `githubOptionId` |
| `labels` | id, teamId, name, color |
| `issues` | id, key (`DAT-2519`), title, description, stateId, priority, estimate, assigneeId, creatorId, labelIds[], dueDate, **parentId** (sub-issues), **relatedIds[]**, **blockedByIds[]**, duplicateOfId, started/completed/canceled/archived timestamps, createdAt, updatedAt, **rev** |
| `comments` | id, issueId, authorId, body, createdAt, updatedAt, rev (synced via the same outbox path) |
| `sync_map` | appwriteId ↔ githubNodeId / projectItemId, lastPushedRev, lastGithubUpdatedAt |
| `sync_ops` | server-side audit/queue of GitHub pushes (status, retries, error) |
| `agents` | handle (`@triage`), role, scopes[], triggers[], autonomy, budget |
| `agent_signals` | agentHandle, triggerType, sourceEntity, contextRef, status, claimedBy, leaseUntil, createdAt |
| `agent_worklog` | issueId, agentHandle, taskId, actions, decisions, openQuestions, nextStep, createdAt — the agent's durable reasoning memory, returned by `get_context` so any cold session resumes where the last left off |

The relation graph (sub-issues, blocked-by, related, duplicate-of) is derived from typed issue-id references — never free text — so "what's blocking DAT-2519?" is a query, not NLP.

---

## Features

**In scope**
- Board with drag-drop states, avatars, priority/label chips, blocked + sub-issue-count indicators
- Issue slide-over: editable fields, **sub-issues**, **relations** (blocked-by / blocks / related / duplicate-of), **comment thread**
- **Command palette** (`⌘K`) and **keyboard-first** UX (single-key actions on the focused card)
- Presence (who's viewing / typing) via Appwrite Realtime
- One-way mirror to **GitHub Projects v2**
- Agent layer: MCP server, bot actors, signals, autopilot toggle, GitHub-comment trigger
- Optional: embeddings/RAG for duplicate detection, semantic `⌘K`, richer agent context

**Deliberately out of scope (for now)**
- Cycles / iterations
- Linear-style "Projects" and milestones

---

## Repository layout (planned)

```
apps/web/            React + TS + Dexie SPA (board, panel, palette)
packages/shared/     entity schema, types, the op-executor, GitHub mapping
packages/mcp/        Offlinear MCP server (signal inbox + write tools)
functions/           Appwrite Functions: board-dispatch, github-webhook, reconcile-cron
scripts/             TablesDB schema-as-code, CSV importer
```

---

## Implementation plan

Each phase is independently shippable and leaves the app in a working state. Phases 0–2 need no external credentials (Appwrite/GitHub are stubbed); Phase 3.5 onward needs real Appwrite + a GitHub App.

### Phase 0 — Scaffold & data foundation

*Goal: an installable monorepo and the real dataset loaded into Appwrite.*

- [ ] pnpm workspace monorepo: `apps/web`, `packages/shared`, `packages/mcp`, `functions/*`, `scripts/`.
- [ ] Tooling: TypeScript (strict), ESLint + Prettier, Vitest, `.env.example`, `tsconfig` base + per-package.
- [ ] `packages/shared`: entity **types** + **Zod schemas** for every table, the canonical **op types** (`Op`, `OpType`, `Patch`), and the **op-executor interface** (pure function `apply(entity, op) → entity`, no I/O) so UI, palette, and agents share one code path.
- [ ] `scripts/schema-push.ts`: TablesDB **schema-as-code** — creates database, tables, columns, indexes, and permissions idempotently. Driven by the shared Zod schemas so schema and types never drift.
- [ ] `scripts/import-csv.ts`: parse the Linear export → upsert `teams`, `states`, `labels`, `members`, `issues` (dedup on `UUID`). See **CSV → schema mapping** below.
- [ ] Seed default `states` (Backlog, Todo, In Progress, In Review, Done, Canceled) and `agents` (`@triage`, `@reviewer`).

**Acceptance:** `pnpm run schema:push && pnpm run import` loads all 3,857 issues into Appwrite with correct states, assignees, labels, and parent/relation links resolved.

### Phase 1 — Local-first core

*Goal: a working board that is fast offline and reconciles when back online.*

- [ ] **Dexie stores** mirroring the server tables + an `outbox` table + a `meta` table (`syncCursor`, `deviceId`).
- [ ] **Op-executor wiring:** every mutation → append `Op` to outbox → apply optimistically to the Dexie row → UI re-renders.
- [ ] **Sync engine:**
  - drain outbox in order → Appwrite (via a `commitOps` path); on ack, stamp authoritative `rev`.
  - **conflict:** server rejects on `baseRev` mismatch → client re-bases pending ops with **field-level LWW** (per-field `updatedAt`).
  - **pull:** Appwrite Realtime subscription while online; **delta pull** by `syncCursor` on reconnect.
  - offline/online detection, retry with backoff, idempotent replay by `opId`.
- [ ] **Board UI** (Linear-like): columns from `states`, drag-drop to change `stateId`, cards with avatar, priority + label chips, blocked indicator, sub-issue count.
- [ ] **Issue slide-over:** editable fields; **sub-issues** (create / promote / reorder); **relations** (blocked-by / blocks / related / duplicate-of) added via `#`-search; **comment thread** (compose / edit / delete — all ops, offline-capable).
- [ ] **Presence:** Appwrite Realtime channel per board — viewers' avatars on cards, "typing" in comments.

**Acceptance:** create/edit/move issues and post comments fully offline; on reconnect everything syncs, and two browsers editing different fields of the same issue both survive (no clobber).

### Phase 2 — Command palette & keyboard-first UX

*Goal: drive the whole board without a mouse — the human twin of the agent path.*

- [ ] **`⌘K` command palette:** create issue, jump-to-issue, and change status/assignee/priority/label of the current selection — every command emits ops through the shared executor.
- [ ] **Focus + selection model:** arrow navigation, `x` to select, multi-select bulk ops.
- [ ] **Single-key actions** on the focused card (Linear-style): `c` new, `s` status, `a` assignee, `p` priority, `l` label; `⌘Enter` submit, `Esc` close.
- [ ] **Relations mini-graph** in the issue panel (blocked-by / related edges).

**Acceptance:** a full triage session — create, assign, prioritize, move, link — completed entirely from the keyboard.

### Phase 2.5 — Agent surface (MCP)

*Goal: Claude Code can read and write the board through one MCP server, using the same ops as humans.*

- [ ] `packages/mcp`: **Offlinear MCP server** (stdio).
  - **read tools:** `next_signal(agent)` / `list_signals` (claim with lease), `get_context(issueKey)` (issue + thread + relations + **worklog** + triggering event), `search_issues(filter)`.
  - **write tools:** `comment`, `move_issue`, `set_assignee/priority/label`, `add_sub_issue`, `link_relation`, `reply_github`, `write_worklog`, `complete_signal` / `fail_signal`.
  - every write constructs an `Op` and goes through the shared executor → audited in `sync_ops`.
- [ ] **Bot actors:** `members` with `isAgent`, scoped API tokens (e.g. comment+move, not delete).
- [ ] **Capability manifest** + entity JSON schema at a known path for tool discovery.
- [ ] **`/offlinear` skill/slash-command** wrapping "pull next signal → get context → act → complete".

**Acceptance:** from Claude Code, `claude mcp add offlinear …` then `/offlinear` triages a real queued signal end-to-end.

### Phase 3 — Signal bus & event waking

*Goal: interactions on the board wake a local Claude Code session, token-efficiently.*

- [ ] `agent_signals` table + `board-dispatch` Appwrite Function (board event → **write row + publish to `offlinear/agent/{handle}/signal`**; trigger taxonomy: mention / assign-to-bot / label / state move / relation event).
- [ ] **MQTT bus (Appwrite Push):** topic scheme, QoS 1 + persistent sessions, retained autopilot/presence topics, `replyTo`/`correlationId` request-reply; Realtime WS as fallback transport.
- [ ] **Claim/lease** semantics (rev-CAS against the `agent_signals` ledger) + expiry retry + reconnect reconciliation backstop.
- [ ] **Autopilot toggle** — cloud `autopilot {enabled, until}` TTL (published retained), runtime loop on/off, and MCP scope guard.
- [ ] **`offlinear-listen`** (tokenless, non-LLM): MQTT subscriber on the agent's signal topic (LWT for presence), debounces ~5s, spawns headless Claude Code — `--resume` for hot issues, cold `claude -p` + `get_context()` otherwise; bounds cost with `--max-turns`, scoped `--allowedTools`, Haiku triage. Publishes results to `offlinear/reply/{correlationId}`.
- [ ] **Agent memory:** `agent_worklog` written at end of each run; `issueKey → sessionId` resume map (capped after N turns / ~1h → cold rehydrate).
- [ ] **Pending-signals UI:** "N pending agent tasks" + live task status/transcript in the issue panel.

**Acceptance:** with autopilot on, mentioning `@triage` on a card causes a local Claude Code session to wake, act, and post a worklog — with zero token cost while idle.

### Phase 3.5 — GitHub Projects v2 mirror & comment trigger

*Goal: Appwrite state mirrors to GitHub; GitHub comments can trigger agents.*

- [ ] **GitHub App** (project + issues scope); credentials in Appwrite Function env/secrets.
- [ ] **Connect-a-project flow:** capture project node id + Status field/option ids + field ids into `sync_map`.
- [ ] **`push-to-github`** (on `issues` TablesDB events): `addProjectV2ItemById` / draft issue, `updateProjectV2ItemFieldValue` for Status + fields; idempotency keys, exponential backoff, `sync_ops` audit.
- [ ] **`github-webhook`** Function: `issue_comment` where the mapped issue's assignee is a bot agent → write `agent_signals` (machine stays outbound-only).
- [ ] **`reconcile-cron`:** periodic drift sweep (GitHub `updatedAt` vs Appwrite) → repush; Appwrite always wins.

**Acceptance:** an issue moved on the board appears/updates on the GitHub Projects v2 board within the sync window; a comment on the linked GitHub thread wakes the assigned agent.

### Phase 4 — Embeddings / RAG (optional)

*Goal: richer agent context and semantic search.*

- [ ] `embed` Function on issue/comment writes → chunk + embed → Appwrite vector store (`embeddings`).
- [ ] **Duplicate detection** on issue create (suggest `duplicate of`).
- [ ] **Semantic `⌘K`** (natural-language issue search).
- [ ] Vector retrieval folded into `get_context` (similar solved issues + resolutions).

**Acceptance:** creating a near-duplicate issue surfaces the likely original; `⌘K` finds issues by meaning, not just title.

---

## CSV → schema mapping

The Linear export (`arnab@appwrite.io › Assigned issues.csv`, 34 columns, dedup on `UUID`) maps as:

| CSV column(s) | Target |
|---|---|
| `ID` (`DAT-2519`) | `issues.key` |
| `Team` | `teams` (upsert by name) |
| `Title`, `Description` | `issues.title`, `issues.description` |
| `Status` | `issues.stateId` (resolve/create in `states`) |
| `Estimate`, `Priority` | `issues.estimate`, `issues.priority` |
| `Creator`, `Assignee` | `members` (upsert by email) → `creatorId`, `assigneeId` |
| `Labels` | `labels` (split, upsert) → `labelIds[]` |
| `Created`/`Updated`/`Started`/`Completed`/`Canceled`/`Archived` | matching `issues` timestamps |
| `Due Date` | `issues.dueDate` |
| `Parent issue` | `issues.parentId` (resolve by key) |
| `Related to`, `Blocked by`, `Duplicate of` | `issues.relatedIds[]`, `blockedByIds[]`, `duplicateOfId` |
| `UUID` | dedup key (not stored as PK) |
| `Cycle*`, `Project*`, `Initiatives`, `Milestone*`, `SLA*`, `Time in status` | **ignored** (out of scope) |

Import is two-pass: pass 1 upserts issues, pass 2 resolves parent/relation references (targets must exist first).

---

## Open decisions (resolved defaults, change before build if needed)

- **Appwrite host:** Cloud vs self-hosted — *need endpoint + project id before Phase 3.5.*
- **GitHub target:** org/repo + Projects v2 board number — *need before Phase 3.5.*
- **Auth:** Appwrite Auth for app login; **GitHub App** (not PAT) for sync.
- **Relationships:** scalar ids + arrays (not TablesDB deep relations) for offline-mirroring simplicity.
- **Default autonomy:** agents start in **`approve`** mode, graduate to autopilot per agent.
- **Agent spawn:** headless `claude -p` / `--resume`; warm-session-on-trigger only if signal traffic is frequent.
- **Signal transport:** **MQTT** via Appwrite Push (QoS 1, retained control topics, request/reply); Realtime WS as fallback. `agent_signals` remains the durable ledger regardless of transport.

---

## Getting started

> Not yet runnable — Phase 0 has not been scaffolded. Once it is:

```bash
# 1. Configure Appwrite (Cloud or self-hosted) + GitHub App
cp .env.example .env      # endpoint, project id, API key, GitHub App creds

# 2. Provision the TablesDB schema
pnpm run schema:push

# 3. Import the Linear CSV export
pnpm run import -- "arnab@appwrite.io › Assigned issues.csv"

# 4. Run the web app
pnpm --filter web dev

# 5. Connect the agent runtime (Claude Code)
claude mcp add offlinear -- node packages/mcp/dist/server.js
# then, in Claude Code:  /offlinear   (or a scheduled loop for autopilot)
```

## Tech stack

- **Client:** React + TypeScript, IndexedDB via Dexie
- **Backend:** Appwrite — TablesDB (truth), Realtime (sync + presence), Push/**MQTT** (signal bus), Functions (thin dispatchers)
- **Mirror:** GitHub Projects v2 (GraphQL, via a GitHub App)
- **Agents:** Claude Code as the runtime, connected through the Offlinear MCP server

---

## License

TBD.
