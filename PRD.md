# Squadrons — Product Requirements Document

**Product:** Squadrons (`squadrons.trade`)  
**Document type:** Product + implementation orientation  
**Status:** Product model locked · Implementation defaults locked for local-dev v1

---

## 1. Vision

Squadrons is a multi-tenant platform for **persistent, named crypto agents**.

Each user gets an isolated space where they create agents the way they would in Grok Bot or Hermes-style bot mode: give the agent a **name, avatar, description, and chain**, then tell it what to do. The agent works toward that goal with its own memory and tools. When the goal is complete, it goes **idle** until given new work.

Self-improvement (procedural learning, playbooks, skill accumulation) exists so agents get better over time, but it is **invisible infrastructure** — not a user-facing “skills” product.

Squadrons is not a fixed multi-squad trading desk (Alpha / Execution / Sentinel). Those were capability sketches. The product unit is the **individual agent**.

---

## 2. Problem

Crypto operators want always-capable helpers that can scout markets, watch opportunities, alert them, and eventually act — without babysitting every step.

Today that usually means:

- One-off chat sessions with no durable agent identity
- Scripts or bots that are brittle and unsafe with keys
- Dashboards that observe but don’t reason toward a goal

Squadrons combines **agent identity + continuous goal work + safe default autonomy** in one product.

---

## 3. Target users

**Primary:** Individuals and small teams who want personal crypto agents (scouts, monitors, later executors) without running their own agent infra.

**Platform shape:** Many users, each with their own agents. Agents and memory are isolated across users.

---

## 4. Product principles

1. **Agent-first** — Users manage a list of agents, not a generic chat thread that forgets who it is.
2. **Goal-bounded** — An agent works a goal, then idles. It does not run forever by default.
3. **Observe before spend** — New agents are read-only until the user explicitly enables spending.
4. **Full-auto inside bounds** — Once spend is enabled, the agent may act within policy without confirming every action. Outside bounds, it pauses for the user.
5. **One wallet, many agents (v1)** — Custody is per user. Per-agent wallets come later.
6. **Learning is invisible** — Agents improve quietly; users see better outcomes, not a skill manager UI.
7. **Fail closed on money** — No broadcast without platform safety checks. The agent proposes intent; it does not hold keys or blind-send.

---

## 5. Core product objects

### 5.1 User / account

- Authenticates (social, email, or wallet via Privy).
- Owns a **single shared wallet** in v1 (public address visible in the product).
- Owns many agents.
- Holds account-level policy defaults that constrain spend-enabled agents.

### 5.2 Agent

The primary user-facing unit.

| Field | Meaning |
| --- | --- |
| Name | Display name (e.g. “Base LP Scout”) |
| Avatar | One of the fixed orb face variants (see §9.1) |
| Description | Short persona / mandate copy |
| Chain | Home / default chain for this agent (`8453` Base for v1 demos) |
| Status | `idle` · `working` · `needs_input` · `paused` |
| Spend mode | `observe` (default) · `spend_enabled` (**per agent**) |
| Current goal | Optional; present while `working` |

Each agent has private memory and learned behavior scoped to that agent (and never leaked across users). Users do not manage memory or skills directly.

### 5.3 Goal

A finite objective the agent is pursuing.

- Assigned during or after create (agent asks what it should do).
- While a goal is active → status `working`.
- **The agent declares goal complete** → status `idle`, goal archived.
- A user can later assign a new goal to an idle agent.
- User can still pause/stop an agent at any time.

**Later (not v1):** cron schedules and event triggers that start or resume goals.

### 5.4 Activity & alerts

- **Activity:** live trail of reasoning, tool use, findings, and (if spend-enabled) proposed or completed actions.
- **Alerts (v1):** **in-app only** — surfaced in the agent activity / notification area. No Discord in v1.

### 5.5 Wallet (v1)

- **One wallet per user**, shared by all of that user’s agents.
- **Spend is per agent:** an observe-only agent cannot spend even though the wallet is shared at account level.

---

## 6. Primary user flows

### 6.1 Create an agent (Grok-bot shaped)

1. User opens **My Agents**.
2. Chooses **New agent**.
3. Sets **name, avatar, description, chain**.
4. Agent is created in `observe` mode.
5. Agent **asks what it needs to do** (clarifying questions as needed).
6. User states the goal → agent status becomes `working`.

**Example:** User creates “Base LP Scout” on Base. Description: scouts LP opportunities. Agent asks for scope (venues, size band, alert vs act). User: “Find the best LP opportunities and alert me in-app; don’t trade.” Agent works the goal, declares complete → idle.

### 6.2 Work a goal

- Agent uses allowed tools toward the goal.
- User can open the agent and see activity, steer with messages, or pause.
- Agent declares goal complete → `idle`.
- On blocker that needs the user → `needs_input`.
- On policy / safety halt → `paused`.

### 6.3 Enable spend (per agent)

1. Agent is in `observe` by default; may only report / alert in-app / ask.
2. User explicitly enables **spend for that agent**.
3. Subsequent actions inside policy may execute automatically (v1 demo caps apply).
4. Actions outside policy pause for user confirmation or are blocked.

### 6.4 Return later

- Idle agents appear in **My Agents** with name, avatar, description, chain, last status.
- User opens an agent and gives a new goal, or reviews past activity / in-app alerts.

---

## 7. Autonomy & safety (product rules)

### Autonomy ladder

| Stage | What the agent may do |
| --- | --- |
| **Observe** (default) | Read balances, quotes, scout opportunities, light web/social search, post **in-app** alerts. No chain writes. |
| **Spend enabled** (per agent) | May execute transactions that pass platform policy and safety gates, without per-trade confirmation. |
| **Needs input / paused** | Stops money movement; surfaces why; waits for the user. |

“Fully auto” means: **no nagging inside approved limits** after spend is on — not auto-spend from birth.

### Hard product guarantees

- Agents never custody raw private keys; signing is delegated to Privy.
- Observe-mode agents cannot move funds.
- Cross-user isolation: one user’s agents cannot see another user’s agents, memory, or activity.
- Money actions are fail-closed: unsafe or out-of-policy intents do not silently execute.

### v1 policy defaults (demo)

| Control | Default |
| --- | --- |
| Max autonomous trade | **$10 USD** |
| Max slippage | **50 bps (0.5%)** |
| First chain | **Base (`8453`)** |
| Execution mode | **Demo-oriented** (sim / low-stakes; real mainnet spend only when intentionally enabled with tiny caps) |

---

## 8. Capabilities (v1 scope)

### In scope

- Multi-user accounts with isolated agents
- My Agents list (create, open, pause, idle after agent-declared goal complete)
- Agent identity: name, avatar (fixed set), description, chain
- Goal intake and agent-declared complete → idle
- Observe-by-default; **per-agent** spend enable
- Shared per-user wallet
- Crypto **read** tools on Base (balances, quotes, opportunity-oriented reads)
- Crypto **write** only when that agent has spend enabled and within $10 / slippage policy
- Light **non-crypto** tools: web/social search as needed for scouting
- **In-app** activity + alerts
- Invisible self-learning behind the scenes

### Explicitly out of scope (v1)

- Fixed Alpha / Execution / Sentinel squad product
- Per-agent wallets
- Cron / scheduled goals
- Event-triggered goals
- User-facing skill / playbook management
- Discord / external alert channels
- Arbitrary third-party API plugin marketplace
- Deep Robinhood brokerage integration (examples are illustrative)
- Always-on agents with no goal bound
- Production VPS multi-tenant hardening (start local; deploy later)

---

## 9. Experience notes

- First surface after login: **My Agents**, not an empty global chat.
- Creating an agent should feel lightweight and characterful (name + avatar + description + chain), then conversational goal intake.
- Activity should feel like watching a capable operator, not reading raw infra logs.
- Spend enable should be an obvious, deliberate **per-agent** control.
- Learning should never require the user to “save a skill” or manage files.

### 9.1 Agent avatars (locked set)

Users pick from a fixed set of **orb face** SVG variants (not free upload in v1). Reference: [`docs/design/agent-avatars-reference.png`](docs/design/agent-avatars-reference.png).

| ID | Name | Eyes |
| --- | --- | --- |
| `01` | Slit bars | Horizontal laser dashes |
| `02` | Vertical pills | Tall vertical columns |
| `03` | Hollow frames | Outline square boxes |
| `04` | Stair-step pixels | Diagonal 8-bit steps |
| `05` | Chevrons | Pixel `>` `<` corners |
| `06` | 1×3 horizontal bars | Triple segmented micro-dots |
| `07` | Slanted ticks | Slight focused squint |
| `08` | Plus clusters | `+` reticle crosses |

Color cycles with the face style (purple / blue / green / orange). Implement as SVGs in the web app; store `avatar_id` on the agent.

---

## 10. Success (product)

We will know v1 is right when:

1. A user can create a named scout agent in under a minute and get useful findings without enabling spend.
2. Multiple agents under one user stay clearly separate in identity and behavior; spend on one does not unlock spend on another.
3. Agent-declared goal complete reliably returns the agent to idle; the list remains understandable.
4. Enabling spend feels intentional; observe-mode never moves funds.
5. Users describe Squadrons as “my crypto bots,” not “a chat with tools.”

---

## 11. Locked product decisions

| Decision | Choice |
| --- | --- |
| Spend enable scope | **Per agent** |
| Who marks goal complete | **Agent declares** (user can still pause/stop) |
| Alerts (v1) | **In-app only** |
| Wallet | **Per user** (per-agent wallets later) |
| First chain | **Base** |
| Default max auto trade | **$10** |
| Discord | **Deferred** |
| Avatars | **Fixed 8 orb faces** (see §9.1) |

---

## 12. Implementation orientation

Not a day-by-day schedule — the technical defaults for local-dev v1.

### 12.1 Stack

| Layer | Choice |
| --- | --- |
| Agent runtime | DeepSeek Harness (`dsh --profile sdk`) |
| Models | OpenRouter |
| Auth + wallet | Privy (web SDK + `@privy-io/node`); **user creates Privy app** |
| Tx safety | Tenderly simulation → policy checks → Privy sign/broadcast |
| Host supervisor | **Node.js 22** |
| Data | SQLite (`better-sqlite3`, WAL) — local file in dev |
| Frontend | Next.js (App Router) |
| Realtime | SSE from host → web (activity stream) |
| Repo | **Monorepo** (`apps/web`, `apps/host`, shared packages as needed) |

### 12.2 Local-dev first

- Run host + web + `dsh` workers on the developer machine.
- No VPS requirement for first vertical slice.
- Process isolation and multi-tenant hardening on a VPS come after the product loop works locally.

### 12.3 Logical architecture

```
Next.js (My Agents, create, activity, spend toggle, in-app alerts)
        │  auth + API / SSE
        ▼
Host daemon (Node 22)
  • users / agents / goals / activity / audit in SQLite
  • spawn/reuse dsh worker per agent (isolated workspace)
  • enforce observe vs spend_enabled per agent
  • Tenderly + $10 / slippage policy before any broadcast
  • Privy server wallet sign only when allowed
        │  JSON-RPC (dsh SDK)
        ▼
dsh worker
  • goal, memory, tools, invisible skills
  • Base read tools always (when chain = Base)
  • tx intent tools only meaningful if spend enabled (host still gates broadcast)
```

### 12.4 Credentials / accounts

| Dependency | Status |
| --- | --- |
| OpenRouter | Ready |
| Tenderly | Ready |
| Privy | **To create** (App ID + server credentials) |
| Discord | N/A for v1 |

### 12.5 Suggested monorepo layout

```
squadrons.trade/
  apps/
    web/          # Next.js — My Agents UI
    host/         # Node supervisor — agents, dsh, policy, Privy, SSE
  packages/
    shared/       # types, policy constants, avatar ids
  docs/
    design/       # avatar reference, etc.
  PRD.md
```

---

## 13. Glossary

| Term | Meaning |
| --- | --- |
| Agent | Named, persistent crypto helper with identity, memory, tools, and status |
| Goal | Finite task the agent is currently working; agent declares completion |
| Observe mode | Read/alert only; no transactions |
| Spend enabled | Per-agent flag; may transact within policy without per-action confirmation |
| Idle | No active goal |
| Activity | User-visible trail of what the agent did and found |
| In-app alert | Notification inside Squadrons (not Discord) |
| Invisible learning | Background improvement of agent procedures; not a user feature |
