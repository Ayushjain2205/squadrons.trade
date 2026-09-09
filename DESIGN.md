# Design system — Squadrons desk

## World

Grok Bot–like **operator desk**: near-black chrome, three columns, orb faces as identity. Operate mode — scanability over marketing.

## Layout

| Region | Role |
| --- | --- |
| Left rail (~280px) | Brand mark (session-random orb + wordmark), search, agent list, New agent, wallet + logout footer |
| Center | Agent header, message stream, pill composer |
| Right rail (~296px, lg+) | Soft identity (description / chain / spend); **Activity** trail; gear → settings |

Mobile: list on `/`; chat full-bleed with back; right rail hidden.

## Color

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#000000` | Page ground |
| `--rail` | `#0a0a0a` | Side rails |
| `--panel` / `--panel-2` | `#141414` / `#1c1c1c` | Wells, selection |
| `--ink` | `#f4f4f5` | Primary text |
| `--ink-soft` / `--muted` | `#a1a1aa` / `#71717a` | Secondary |
| `--accent` | `#5dcea0` | Status / working |
| `--link` | `#60a5fa` | Links |

## Type

Cherry Bomb One (wordmark), Manrope (UI + display), IBM Plex Mono (chain ids / meta).

| Role | Token / class | Size | Notes |
| --- | --- | --- | --- |
| Brand | `.type-brand` | rail 1.65rem / hero ~3.75rem | Cherry Bomb only |
| Display | `.type-display` / `-lg` | 1.5rem / 1.875rem | Manrope 600, tight tracking |
| Title | `.type-title` | 1.0625rem | Panel / chat chrome headings |
| Body | `.type-body` | 0.9375rem (15px) | Chat + forms; measure `--measure-chat` 38rem |
| UI | `.type-ui` | 0.875rem | Chrome, CTAs, list chrome |
| Label | `.type-label` | 0.875rem / 500 | Form legends |
| Meta | `.type-meta` | 0.75rem floor | Timestamps, hints |
| Data | `.type-data` | 0.75rem+ mono | Chain ids, clocks, code cells |

`--muted` `#8a8a93` for AA on canvas at meta sizes. Display alias: `--font-display` → `--font-body` (one Manrope load).

## Components

- Agent list rows: orb + name + preview + relative time; selected = `--panel-2`
- Messages: large radius wells; user right / assistant left; clock in bubble
- Composer: full pill, `+` affordance, circular send
- Right rail: soft identity line + abstracted Activity trail (human verbs, no tool dumps); gear opens settings
- Orbs: 8 faces × 7 colors, chosen independently
- Loading: login-shaped skeleton while Privy boots (auth unknown); desk skeletons (rail / chat / context) only after login while data resolves. BrandMark stays live on desk loads.

## Activity

Highly abstracted Grok Bot–style steps. Present tense only while in flight (“Looking up balances”); past tense when done (“Looked up balances”). No turn markers, raw args, or result JSON.
