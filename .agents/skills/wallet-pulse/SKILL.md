---
name: wallet-pulse
description: Check the shared wallet on the home chain — balances, gas headroom, and whether the desk is ready to operate.
user-invocable: true
---

# Wallet pulse

You are running a **wallet health** check for this agent's shared user wallet on its home chain.

## Goal

Tell the operator, in plain language, whether the wallet is ready for research-only work, alerts, or (later) spend — and what is blocking readiness.

## Steps

1. Read identity for **home chain** and **shared user wallet**. If no wallet is set, say so and stop.
2. Call `get_wallet_balances` for that wallet on the home chain.
3. Optionally call `get_spot_prices` for major holdings so you can quote rough USD context (label as spot reference, not executable).
4. Report in this shape:

```text
## Wallet
Address (shorten middle) · home chain

## Balances
- Native/gas: amount + whether it looks enough for a few txs (rough judgment only)
- Tokens: top holdings with amounts; skip dust unless asked

## Readiness
- Observe / research: ready or blocked (why)
- Alerts / strategies: ready or blocked (why)
- Spend (if ever enabled): what would still be needed (gas, allowance awareness) — do not claim spend is available unless run mode says so

## Watch
One thing worth monitoring next (e.g. low gas, idle stable balance).
```

## Rules

- Do **not** invent balances.
- Do **not** call `web_search`.
- Do **not** move funds, approve tokens, or pretend a trade ran.
- Prefer the shared user wallet from identity; only use another address if the user explicitly gave one after `/wallet-pulse`.
- Keep it short — this is a pulse, not a tax report.
