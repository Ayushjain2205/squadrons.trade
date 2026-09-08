# Design system — Squadrons desk

## World

Grok Bot–like **operator desk**: near-black chrome, three columns, orb faces as identity. Operate mode — scanability over marketing.

## Layout

| Region | Role |
| --- | --- |
| Left rail (~280px) | Search, agent list, New agent, local-dev footer |
| Center | Agent header, message stream, pill composer |
| Right rail (~296px, lg+) | Goal, status, about; settings (name, face, color, description, chain) |

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

## Components

- Agent list rows: orb + name + preview + relative time; selected = `--panel-2`
- Messages: large radius wells; user right / assistant left; clock in bubble
- Composer: full pill, `+` affordance, circular send
- Right rail: goal / status / about; gear opens inline settings (identity + face/color + chain)
- Orbs: 8 faces × 8 colors, chosen independently
