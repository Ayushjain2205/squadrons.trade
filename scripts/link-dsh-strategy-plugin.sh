#!/usr/bin/env bash
# Link packages/squadrons-strategy into the local dsh sdk profile (same pattern as squadrons-defi).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${DSH_HOME:-$HOME/.dsh}/profiles/sdk"
PKG="$ROOT/packages/squadrons-strategy"

if [[ ! -d "$PROFILE" ]]; then
  echo "dsh sdk profile not found at $PROFILE" >&2
  exit 1
fi

node <<EOF
const fs = require("fs");
const path = require("path");
const file = path.join("$PROFILE", "package.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
data.dependencies = data.dependencies || {};
data.dependencies["squadrons-strategy"] = "link:$PKG";
data.dsh = data.dsh || {};
data.dsh.profile = data.dsh.profile || {};
data.dsh.profile.bundles = data.dsh.profile.bundles || [];
if (!data.dsh.profile.bundles.includes("squadrons-strategy")) {
  data.dsh.profile.bundles.push("squadrons-strategy");
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log("Updated", file);
EOF

(cd "$PROFILE" && pnpm install --no-frozen-lockfile)
echo "squadrons-strategy linked into dsh sdk profile"
