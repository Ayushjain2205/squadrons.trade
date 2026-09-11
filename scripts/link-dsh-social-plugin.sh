#!/usr/bin/env bash
# Deprecated entrypoint — use: pnpm --filter @squadrons/host dsh:link
exec "$(cd "$(dirname "$0")/.." && pwd)/apps/host/scripts/dsh/link-plugins.sh" "$@"
