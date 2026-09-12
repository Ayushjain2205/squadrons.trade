# Strategies

How Squadrons turns chat into a durable, host-run loop.

## Mental model

| Layer | Who | Job |
| --- | --- | --- |
| **Chat** | LLM | Research, dig, and author/edit strategy (recipe + params); can patch params live |
| **Runtime** | Host | Wake on schedule/event → run **recipe** deterministically |
| **Self-improvement** | Host + constrained LLM | On a strategy cadence, suggest param patches → desk **Approve / Dismiss** |

Arm is always a human desk action. Runtime ticks do **not** call an LLM.

## Templates

Curated, chain-filtered **prefilled drafts** over built-in recipes (Squadrons-authored only).

- Browse from the Strategy card → **Import draft** (defaults) → refine in chat → Arm
- Import writes the same strategy draft as chat `propose_strategy`
- User still **Arms** — templates never auto-run
- Catalog entries include name, blurb, longer description, tags, and chain scope
- Catalog: `packages/shared/src/templates.ts`
- Host: `GET /v1/strategy/templates?chainId=` · `POST /v1/agents/:id/strategy/from-template`

## Artifact

One strategy per agent:

- `recipeId` — built-in playbook
- `params` — knobs for that recipe
- `trigger` — `interval` or `event` (host wake)
- `action` — `alert` or `propose_trade` (spend still fail-closed / propose-only)
- `caps` — hard limits
- `improvement` — `{ enabled, cadence: hourly|daily|weekly, allowedKeys, lastRunAt }` (`autoApply` stays false in v1)

### Recipes

| Id | Job |
| --- | --- |
| `balance_threshold_alert` | Native/ETH or known ERC-20 (USDC/WETH) threshold |
| `price_band_alert` | Spot USD outside `[low, high]` |
| `price_cross_alert` | Spot USD crosses a level (pair with `event: price_cross`) |
| `price_cross_swap` | Same cross edge → propose capped USDC↔ETH/WETH swap (`side`, `amountUsd`) |
| `take_profit_stop` | TP above / stop below → propose exit swap (pair with `event: price_tp_stop`) |

Recipes live in `apps/host/src/strategy/recipes/`. Catalog / param schemas live in `@squadrons/shared` (`recipes.ts`).

### Event wakes

`trigger: { type: "event", event: "price_cross", intervalSec }` polls on `intervalSec` but stays quiet until an edge fires, then runs the recipe once. `price_tp_stop` does the same for take-profit / stop-loss levels. Edge state is in-memory (resets on host restart / disarm).

## Flow

```text
Chat or Template → propose_strategy / import (draft)
                 → user Arms
                 → host scheduler wakes due strategies
                 → (event) edge check → quiet | fire
                 → executeStrategyRecipe → Strategy activity
                 → (optional) update_strategy_params while running
                 → desk can toggle self-improvement cadence

If improvement.enabled:
  cadence due → self-improvement dsh review
             → propose_improvement → pending proposal
             → Strategy card Approve → patchParams
             → or Dismiss
```

## Tools (chat / improvement)

- `propose_strategy` — full draft (not while `running`; pause/disarm first)
- `update_strategy_params` — live param patch (draft / paused / running)
- `propose_improvement` — queue a desk proposal (does not apply)
- `get_strategy` — read desk state + pending draft

Legacy strategies without `recipeId` cannot Arm / are paused if somehow running. Runtime ticks never call an LLM.

## Activity sources

- `chat` — desk conversation tools (shown under the message)
- `strategy` — runtime ticks / recipe outcomes (Strategy activity rail)
- `system` — arm / pause / params / improvement lifecycle

The Strategy card is a desk control: status + plain-language plan + Arm/Pause, quieter schedule/spend/last-check, Approve/Dismiss when a proposal is pending, and self-improvement / caps under **Details**.

The Strategy activity rail collapses quiet checks into a single “last check” line; the list is alerts, errors, and desk changes. It pages from the host (`limit` + `before`/`beforeId`), shows a few rows, then **Show more** / **Load older** — never dumps the full history into the DOM. **Live** only while `strategy.status === "running"`.

## Key paths

| Path | Role |
| --- | --- |
| `packages/shared/src/templates.ts` | Curated template catalog |
| `packages/shared/src/strategy.ts` | Types + draft / proposal parsers |
| `packages/shared/src/recipes.ts` | Recipe ids + param validation |
| `packages/squadrons-strategy/` | Cordis tools |
| `apps/host/src/strategy/scheduler.ts` | Interval / event wake loop |
| `apps/host/src/strategy/events.ts` | Event edge detectors |
| `apps/host/src/strategy/recipes/` | Deterministic executors |
| `apps/host/src/strategy/improvement.ts` | Cadence reviews |
| `apps/web/.../StrategyCard.tsx` | Arm / improvement / Approve·Dismiss |

## Adding a recipe

1. Add id + param schema to `packages/shared/src/recipes.ts`
2. Mirror validation in `packages/squadrons-strategy/validate.js`
3. Add executor under `apps/host/src/strategy/recipes/` and register in `index.ts`
4. Mention it in the agent prompt (`apps/host/src/dsh/prompt.ts`)
5. Optionally wrap it in a curated template in `packages/shared/src/templates.ts`
