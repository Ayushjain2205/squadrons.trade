# Squadrons — Product Requirements Document

**Product:** Squadrons (`squadrons.trade`)  
**Document type:** Product specification  
**Status:** Draft — product model locked; open decisions noted at end

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
- Holds account-level policy defaults (e.g. max trade size, slippage) that constrain spend-enabled agents.

### 5.2 Agent

The primary user-facing unit.

| Field | Meaning |
| --- | --- |
| Name | Display name (e.g. “Robinhood LP Scout”) |
| Avatar | Visual identity |
| Description | Short persona / mandate copy |
| Chain | Home / default chain for this agent |
| Status | `idle` · `working` · `needs_input` · `paused` |
| Spend mode | `observe` (default) · `spend_enabled` |
| Current goal | Optional; present while `working` |

Each agent has private memory and learned behavior scoped to that agent (and never leaked across users). Users do not manage memory or skills directly.

### 5.3 Goal

A finite objective the agent is pursuing.

- Assigned during or after create (agent asks what it should do).
- While a goal is active → status `working`.
- When the goal is complete → status `idle`, goal cleared or archived.
- A user can later assign a new goal to an idle agent.

**Later (not v1):** cron schedules and event triggers that start or resume goals.

### 5.4 Activity

The live trail of an agent: reasoning, tool use, findings, alerts, and (if spend-enabled) proposed or completed actions. This is how the user watches the agent without living inside a raw terminal.

### 5.5 Wallet (v1)

- **One wallet per user**, shared by all of that user’s agents.
- Spend permission is separate from wallet ownership (see open decisions): an observe-only agent must not be able to spend even though the wallet exists at account level.

---

## 6. Primary user flows

### 6.1 Create an agent (Grok-bot shaped)

1. User opens **My Agents**.
2. Chooses **New agent**.
3. Sets **name, avatar, description, chain**.
4. Agent is created in `observe` mode, status `idle` or immediately enters goal intake.
5. Agent **asks what it needs to do** (clarifying questions as needed).
6. User states the goal → agent status becomes `working`.

**Example:** User creates “Robinhood LP Scout” on Base. Description: scouts LP opportunities. Agent asks for scope (venues, size band, alert vs act). User: “Find the best LP opportunities and alert me; don’t trade.” Agent works the goal, then idles when done (or when the user stops it).

### 6.2 Work a goal

- Agent uses allowed tools toward the goal.
- User can open the agent and see activity, steer with messages, or pause.
- On goal completion → `idle`.
- On blocker that needs the user → `needs_input`.
- On policy / safety halt → `paused`.

### 6.3 Enable spend

1. Agent (or user) reaches a point where action requires transactions.
2. If spend is off, agent stays in observe mode and may only report / alert / ask.
3. User explicitly enables spend for that agent (or account — see open decisions).
4. Subsequent actions inside policy may execute automatically.
5. Actions outside policy pause for user confirmation or are blocked.

### 6.4 Return later

- Idle agents appear in **My Agents** with name, avatar, description, chain, last status.
- User opens an agent and gives a new goal, or reviews past activity.

---

## 7. Autonomy & safety (product rules)

### Autonomy ladder

| Stage | What the agent may do |
| --- | --- |
| **Observe** (default) | Read balances, quotes, scout opportunities, social/search, send alerts. No chain writes. |
| **Spend enabled** | May execute transactions that pass platform policy and safety gates, without per-trade confirmation. |
| **Needs input / paused** | Stops money movement; surfaces why; waits for the user. |

“Fully auto” means: **no nagging inside approved limits** after spend is on — not auto-spend from birth.

### Hard product guarantees

- Agents never custody raw private keys in the product experience; signing is delegated to the platform wallet provider.
- Observe-mode agents cannot move funds.
- Cross-user isolation: one user’s agents cannot see another user’s agents, memory, or activity.
- Money actions are fail-closed: unsafe or out-of-policy intents do not silently execute.

Exact simulation / policy machinery is implementation detail; the product requirement is the **guarantee**, not the vendor list.

---

## 8. Capabilities (v1 scope)

### In scope

- Multi-user accounts with isolated agents
- My Agents list (create, open, pause, idle after goal complete)
- Agent identity: name, avatar, description, chain
- Goal intake and goal-complete → idle
- Observe-by-default; explicit spend enable
- Shared per-user wallet
- Crypto **read** tools appropriate to the agent’s chain (balances, quotes, opportunity-oriented reads)
- Crypto **write** only when spend-enabled and within policy
- A small set of **non-crypto** tools: e.g. social/web search, Discord (or similar) alerts
- Activity stream so users can follow what an agent is doing
- Invisible self-learning behind the scenes

### Explicitly out of scope (v1)

- Fixed Alpha / Execution / Sentinel squad product
- Per-agent wallets
- Cron / scheduled goals
- Event-triggered goals
- User-facing skill / playbook management
- Arbitrary third-party API plugin marketplace
- Deep Robinhood brokerage integration (name in examples is illustrative; v1 uses supported crypto venues/tools)
- Always-on agents with no goal bound

---

## 9. Experience notes

- First surface after login: **My Agents**, not an empty global chat.
- Creating an agent should feel lightweight and characterful (name + avatar + description + chain), then conversational goal intake.
- Activity should feel like watching a capable operator, not reading raw infra logs — though power users may want detail.
- Spend enable should be an obvious, deliberate control — not buried, not accidental.
- Learning should never require the user to “save a skill” or manage files.

---

## 10. Success (product)

We will know v1 is right when:

1. A user can create a named scout agent in under a minute and get useful findings without enabling spend.
2. Multiple agents under one user stay clearly separate in identity and behavior.
3. Goal complete reliably returns the agent to idle; the list remains understandable.
4. Enabling spend feels intentional; observe-mode never moves funds.
5. Users describe Squadrons as “my crypto bots,” not “a chat with tools.”

---

## 11. Open product decisions

Resolve these before locking UX copy and settings IA:

1. **Spend enable scope** — Per agent (recommended: scout agents stay observe-only even if another agent may spend on the shared wallet) vs account-global.
2. **Who marks a goal complete** — Agent self-declares, user confirms, or either.
3. **Alerts surface** — In-app inbox only, Discord/external only, or both in v1.

---

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Agent | Named, persistent crypto helper with identity, memory, tools, and status |
| Goal | Finite task the agent is currently working |
| Observe mode | Read/alert only; no transactions |
| Spend enabled | May transact within policy without per-action confirmation |
| Idle | No active goal |
| Activity | User-visible trail of what the agent did and found |
| Invisible learning | Background improvement of agent procedures; not a user feature |
