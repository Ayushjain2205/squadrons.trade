#!/usr/bin/env bash
# Deprecated entrypoint — use: pnpm --filter @squadrons/host dsh:repair
exec "$(cd "$(dirname "$0")/.." && pwd)/apps/host/scripts/dsh/repair-profile.sh" "$@"
