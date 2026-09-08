# Squadrons

Multi-tenant platform for persistent, named crypto agents.

See [PRD.md](./PRD.md) for product and implementation orientation.

## Monorepo

| Package | Role |
| --- | --- |
| `apps/web` | Next.js — My Agents UI |
| `apps/host` | Node 22 supervisor — agents, dsh, policy, Privy, SSE |
| `packages/shared` | Shared types, policy defaults, avatar IDs |

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 9+

## Setup

```bash
pnpm install
```

Copy env examples when present:

```bash
cp apps/host/.env.example apps/host/.env
cp apps/web/.env.example apps/web/.env.local
```

`@squadrons/shared` is consumed from TypeScript source (Next transpiles it; host runs via `tsx`). No separate shared build step for local `pnpm dev`.

## Develop

```bash
# both apps
pnpm dev

# individually
pnpm dev:web
pnpm dev:host
```

- Web: http://localhost:3000
- Host: http://localhost:8787

## Step 1 — dsh smoke

Requires a working `sdk` profile (`dsh --profile sdk --help`).

```bash
pnpm --filter @squadrons/host dsh:smoke
# or: curl -X POST http://localhost:8787/v1/dsh/smoke -H 'content-type: application/json' -d '{"prompt":"say hi"}'
```

## Step 2 — agents + workspaces

Local-dev user defaults to `local-dev` (override with `X-User-Id`).

```bash
curl -s -X POST http://localhost:8787/v1/agents \
  -H 'content-type: application/json' \
  -d '{"name":"Base Scout","avatarId":"01","description":"Scouts LP opportunities on Base"}'
```

## Step 3 — My Agents UI

With host running on `:8787`:

```bash
pnpm dev:web
# open http://localhost:3000
```

List agents, create with orb faces, open an agent and chat.

New agents start idle with a short greeting. The host keeps a long-lived dsh harness + session per agent in-process (new session after host restart or home-chain change). Context pressure uses dsh’s built-in `@deepseek-ai/dsh-compaction-basic` from the `sdk` profile (`dsh-base`) — no custom summarizer. Mid-turn tool activity streams over SSE (`GET /v1/agents/:id/events`) and is persisted in SQLite (`GET /v1/agents/:id/activity`). Observe-mode dsh patch disables shell/fs/subagents; keeps web/todo/goal/skill plus **`get_wallet_balances`** (home-chain scoped) and **`get_spot_prices`** (USD reference) from `packages/squadrons-defi`.

Optional: set `SQUADRONS_DEMO_WALLET` in `apps/host/.env` so the balances tool has a default address.
