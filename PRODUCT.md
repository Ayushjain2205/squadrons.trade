# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Crypto operators who want persistent named agents (scouts / bots) they can chat with and put to work on-chain without babysitting every step.

## Product Purpose

Squadrons lets a user create named crypto agents (name, avatar, description, chain) and talk to them continuously — Grok Bot–shaped desk, observe-by-default, spend enabled per agent within tight caps.

## Positioning

Not a chat with tools — a roster of characterful crypto agents with memory and an activity trail. Closest UI reference for the desk shell: Grok Bot (three-column agent list / chat / context).

## Key Capabilities

- My Agents roster; create with fixed orb avatars + colors
- Continuous per-agent chat (no mandatory goal intake)
- Chat drafts strategies; Arm starts a host-run strategy loop
- Curated strategy **templates** (chain-filtered drafts you import, then Arm)
- Deterministic strategy **recipes** + params (not LLM-on-every-tick)
- Optional **self-improvement** cadence → approve param patches in the desk
- Live + historical activity trail (chat tools vs strategy ticks split by `source`)
- Observe-mode tools (balances, web, etc.); spend later (propose-only)
- In-app chat / activity (no Discord in v1)

## Constraints

- First chains: Base, Ethereum, Robinhood
- Default auto-trade cap: $10 (when spend exists)
- No user-facing skill/playbook manager in v1
- Strategy playbooks are platform recipes (see docs/STRATEGY.md), not user-uploaded code
- Auth: Privy required (email / wallet); one shared embedded EVM wallet per user

## Brand Commitments

- Product name: Squadrons
- Avatars: fixed 8 orb faces × independent colors
- Desk layout preference (user-pinned): Grok Bot–like three columns

## Accessibility

Keyboard-reachable navigation and controls; contrast suitable for dark desk UI.
