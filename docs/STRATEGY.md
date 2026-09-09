# Strategies

How Squadrons turns chat into a durable, host-run loop.

## Mental model

| Layer | Who | Job |
| --- | --- | --- |
| **Scout** | Chat / LLM | Research only |
| **Operate** | Chat / LLM | Author or edit strategy (recipe + params); can patch params live |
| **Runtime** | Host | Wake on schedule/event → run **recipe** deterministically |
| **Self-improvement** | Host + constrained LLM | On a strategy cadence, suggest param patches → desk **Approve / Dismiss** |

Arm is always a human desk action. Runtime ticks do **not** call an LLM when the strategy has a `recipeId`.

## Artifact

One strategy per agent:

- `recipeId` — built-in playbook (`balance_threshold_alert`, `price_band_alert`, …)
- `params` — knobs for that recipe
- `trigger` — `interval` or `event` (host wake; event may poll with `intervalSec` in v1)
- `action` — `alert` or `propose_trade` (spend still fail-closed / propose-only)
- `caps` — hard limits
- `improvement` — `{ enabled, cadence: hourly|daily|weekly, allowedKeys, lastRunAt }` (`autoApply` stays false in v1)

Recipes live in `apps/host/src/strategy/recipes/` (modular registry). Catalog / param schemas live in `@squadrons/shared` (`recipes.ts`).

## Flow

```text
Scout → Operate → propose_strategy (draft)
                 → user Arms
                 → host scheduler wakes due strategies
                 → executeStrategyRecipe → Strategy activity
                 → (optional) update_strategy_params while running

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

Legacy strategies without `recipeId` cannot Arm until re-proposed; old LLM ticks remain only as a compat path.

## Activity sources

- `chat` — desk conversation tools (shown under the message)
- `strategy` — runtime ticks / recipe outcomes (Strategy activity rail)
- `system` — arm / pause / params updated / improvement lifecycle

## Key paths

| Path | Role |
| --- | --- |
| `packages/shared/src/strategy.ts` | Types + draft / proposal parsers |
| `packages/shared/src/recipes.ts` | Recipe ids + param validation |
| `packages/squadrons-strategy/` | Cordis tools |
| `apps/host/src/strategy/scheduler.ts` | Interval wake loop |
| `apps/host/src/strategy/recipes/` | Deterministic executors |
| `apps/host/src/strategy/improvement.ts` | Cadence reviews |
| `apps/host/src/strategy/improvement-store.ts` | Proposal persistence |
| `apps/web/.../StrategyCard.tsx` | Arm / params / Approve·Dismiss |

## Adding a recipe

1. Add id + param schema to `packages/shared/src/recipes.ts`
2. Mirror validation in `packages/squadrons-strategy/validate.js`
3. Add executor under `apps/host/src/strategy/recipes/` and register in `index.ts`
4. Mention it in the Operate prompt (`apps/host/src/dsh/prompt.ts`)
