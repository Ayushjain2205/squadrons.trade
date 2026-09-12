---
name: market-analyser
description: Analyse home-chain market conditions — trending pools, recent flow, and spot context — then give a concise operator brief.
user-invocable: true
---

# Market analyser

You are running a **market analysis** pass for this agent's home chain. Be concrete and tool-backed — no vibes-only takes.

## Goal

Produce a short operator brief the user can act on (watch, ignore, or draft a strategy). Prefer clarity over coverage.

## Steps

1. Confirm the agent's **home chain** from identity. Stay on that chain unless the user named another.
2. Pull live context with tools (use what is available; skip missing tools without inventing numbers):
   - `get_trending_pools` — what is moving now
   - `get_recent_trades` or `get_token_pools` — when a specific token/pool matters
   - `get_spot_prices` — USD reference for majors (ETH, etc.)
   - `get_dex_volumes` / `get_stablecoin_market` — only if breadth helps the brief
   - `search_x` — optional rumor check; label clearly as unverified social noise
3. Synthesize into this shape (keep it tight):

```text
## Pulse
1–2 sentences on what stands out right now.

## What's moving
- Bullet list of pools/tokens with one metric each (volume, price move, or flow). Cite tool numbers.

## Risks / noise
- Thin liquidity, washy flow, or social rumors to discount.

## Suggested next move
One concrete option: keep watching, set an alert strategy, or dig a named token — not a portfolio lecture.
```

## Rules

- Do **not** invent prices, volumes, or pool addresses.
- Do **not** call `web_search`.
- Do **not** propose trades as executed facts; observe / alert / draft strategy only.
- If tools fail or return empty, say so and stop — do not fill gaps with guesses.
- If the user already named a token or question after `/market-analyser`, prioritize that over a general scan.
