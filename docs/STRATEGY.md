# Strategies

How Squadrons turns chat into a durable, host-run loop.

## Mental model

| Layer | Who | Job |
| --- | --- | --- |
| **Scout** | Chat / LLM | Research only |
| **Operate** | Chat / LLM | Author or edit strategy (recipe + params); can patch params live |
| **Runtime** | Host | Wake on schedule/event → run **recipe** deterministically |
| **Self-improvement** | Host + constrained LLM | On a strategy cadence, suggest param patches → desk **Approve / Dismiss** |

Arm is always a human desk action. Runtime ticks do **not** call an LLM.

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

Recipes live in `apps/host/src/strategy/recipes/`. Catalog / param schemas live in `@squadrons/shared` (`recipes.ts`).

### Event wakes

`trigger: { type: "event", event: "price_cross", intervalSec }` polls on `intervalSec` but stays quiet until an edge fires, then runs the recipe once. Edge state is in-memory (resets on host restart / disarm).

## Flow

```text
Scout → Operate → propose_strategy (draft)
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

## Tools (Operate / improvement)

- `propose_strategy` — full draft (not while `running`; pause/disarm first)
- `update_strategy_params` — live param patch (draft / paused / running)
- `propose_improvement` — queue a desk proposal (does not apply)
- `get_strategy` — read desk state + pending draft

Legacy strategies without `recipeId` cannot Arm / are paused if somehow running. Runtime ticks never call an LLM.

## Activity sources

- `chat` — desk conversation tools (shown under the message)
- `strategy` — runtime ticks / recipe outcomes (Strategy activity rail)
- `system` — arm / pause / params / improvement lifecycle

The Strategy activity rail collapses quiet checks into a single “last check” line; the list is alerts, errors, and desk changes. It pages from the host (`limit` + `before`/`beforeId`), shows a few rows, then **Show more** / **Load older** — never dumps the full history into the DOM. **Live** only while `strategy.status === "running"`.

## Key paths

| Path | Role |
| --- | --- |
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
4. Mention it in the Operate prompt (`apps/host/src/dsh/prompt.ts`)
