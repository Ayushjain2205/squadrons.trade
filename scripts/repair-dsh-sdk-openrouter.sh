#!/usr/bin/env bash
# Bootstrap / repair apps/host/data/dsh-home (workspace-local DSH_HOME).
# Fixes "no adapter registered for provider openrouter" when ~/.dsh/profiles/sdk is thin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/apps/host/data/dsh-home"
PATCH="$ROOT/apps/host/dsh/squadrons.llm.cordis.yml"

mkdir -p "$DEST/profiles/sdk"

if [[ -f "$HOME/.dsh/settings.yaml" ]]; then
  cp "$HOME/.dsh/settings.yaml" "$DEST/settings.yaml"
else
  cat > "$DEST/settings.yaml" <<'YAML'
llm-pi-ai:
  providers:
    openrouter:
      apiKeyEnv: OPENROUTER_API_KEY

agent-default-model:
  provider: openrouter
  model: deepseek/deepseek-v4-flash
YAML
fi

cat > "$DEST/profiles/sdk/package.json" <<EOF
{
  "name": "dsh-profile-sdk",
  "private": true,
  "dependencies": {
    "@deepseek-ai/dsh-base": "0.1.2-rc.1",
    "@deepseek-ai/dsh-sdk-app": "0.1.2-rc.1",
    "squadrons-defi": "link:$ROOT/packages/squadrons-defi",
    "squadrons-strategy": "link:$ROOT/packages/squadrons-strategy"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-sdk-app",
        "squadrons-defi",
        "squadrons-strategy"
      ],
      "patchReload": "startup"
    }
  }
}
EOF

cat > "$DEST/profiles/sdk/cordis.patch.yml" <<'YAML'
- id: llm-pi-ai
  name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      openrouter:
        apiKeyEnv: OPENROUTER_API_KEY

- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: openrouter
    model: deepseek/deepseek-v4-flash
YAML

cat > "$DEST/profiles/sdk/cordis.yml" <<'YAML'
[]
YAML

cat > "$DEST/profiles/sdk/.npmrc" <<'EOF'
node-linker=hoisted
auto-install-peers=false
EOF

cat > "$DEST/profiles/sdk/pnpm-workspace.yaml" <<'EOF'
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
EOF

cd "$DEST/profiles/sdk"
pnpm install

echo
echo "Verifying openrouter…"
set -a
# shellcheck disable=SC1091
source "$ROOT/apps/host/.env"
set +a
export DSH_HOME="$DEST"
dsh --profile sdk --patch "$PATCH" --dump-config 2>/dev/null \
  | rg -n "openrouter|llm-pi-ai" | head -20

echo
echo "OK. Restart the host (it auto-picks apps/host/data/dsh-home)."
