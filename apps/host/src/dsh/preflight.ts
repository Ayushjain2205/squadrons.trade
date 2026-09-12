import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { hostRoot } from "../db.js";
import { LLM_PATCH_PATH, OBSERVE_PATCH_PATH } from "./prompt.js";
import { SQUADRONS_DSH_PLUGINS } from "./plugins.js";

export type DshPreflightIssue = {
  code: string;
  message: string;
  fix?: string;
};

export type DshPreflightResult = {
  ok: boolean;
  dshHome: string;
  usingWorkspaceHome: boolean;
  issues: DshPreflightIssue[];
  checkedAt: number;
};

function workspaceDshHome(): string {
  return path.join(hostRoot, "data", "dsh-home");
}

/** Same resolution as the harness runner. */
export function resolveDshHome(): string {
  if (process.env.DSH_HOME) return process.env.DSH_HOME;
  const local = workspaceDshHome();
  if (existsSync(local)) return local;
  return path.join(os.homedir(), ".dsh");
}

function repoRoot(): string {
  return path.resolve(hostRoot, "../..");
}

function pluginPackageDir(name: string): string {
  return path.join(repoRoot(), "packages", name);
}

/**
 * Linked Cordis packages resolve imports from packages/<name>, not from the
 * dsh profile node_modules. If @deepseek-ai/dsh-tools is missing there, the
 * whole plugin tree fails to load and initialize lies with NO_ADAPTER/openrouter.
 */
function canImportDshTools(pluginDir: string): boolean {
  const entry = path.join(pluginDir, "index.js");
  if (!existsSync(entry)) return false;

  // Preferred: package-local install/link (what pnpm creates for dependencies).
  if (existsSync(path.join(pluginDir, "node_modules/@deepseek-ai/dsh-tools"))) {
    return true;
  }

  try {
    const require = createRequire(entry);
    require.resolve("@deepseek-ai/dsh-tools");
    return true;
  } catch {
    return false;
  }
}

function readProfileBundles(dshHome: string): string[] {
  const pkgPath = path.join(dshHome, "profiles/sdk/package.json");
  if (!existsSync(pkgPath)) return [];
  try {
    const data = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dsh?: { profile?: { bundles?: string[] } };
      dependencies?: Record<string, string>;
    };
    return data.dsh?.profile?.bundles ?? [];
  } catch {
    return [];
  }
}

/**
 * Static checks — fast, no subprocess. Catches the failure mode that
 * previously surfaced as "no adapter registered for provider openrouter".
 */
export async function runDshPreflight(): Promise<DshPreflightResult> {
  const issues: DshPreflightIssue[] = [];
  const dshHome = resolveDshHome();
  const workspaceHome = workspaceDshHome();
  const usingWorkspaceHome = path.resolve(dshHome) === path.resolve(workspaceHome);

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    issues.push({
      code: "missing_openrouter_key",
      message: "OPENROUTER_API_KEY is not set",
      fix: "Add OPENROUTER_API_KEY to apps/host/.env",
    });
  }

  if (!usingWorkspaceHome) {
    issues.push({
      code: "wrong_dsh_home",
      message: `DSH_HOME is ${dshHome} (expected workspace ${workspaceHome})`,
      fix: "Unset DSH_HOME or run: pnpm --filter @squadrons/host dsh:repair",
    });
  }

  if (!existsSync(path.join(dshHome, "profiles/sdk/package.json"))) {
    issues.push({
      code: "missing_sdk_profile",
      message: `No sdk profile at ${path.join(dshHome, "profiles/sdk")}`,
      fix: "pnpm --filter @squadrons/host dsh:repair",
    });
  }

  if (!existsSync(LLM_PATCH_PATH) || !existsSync(OBSERVE_PATCH_PATH)) {
    issues.push({
      code: "missing_patches",
      message: "Squadrons llm/observe Cordis patches are missing under apps/host/dsh/",
    });
  }

  const bundles = readProfileBundles(dshHome);
  const profilePkgPath = path.join(dshHome, "profiles/sdk/package.json");
  if (existsSync(profilePkgPath)) {
    try {
      const data = JSON.parse(readFileSync(profilePkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
      };
      if (!data.dependencies?.["@deepseek-ai/dsh-mcp-client"]) {
        issues.push({
          code: "missing_mcp_client",
          message:
            "sdk profile is missing @deepseek-ai/dsh-mcp-client — catalog/custom MCP plugins will load with zero tools",
          fix: "pnpm --filter @squadrons/host dsh:link",
        });
      }
    } catch {
      // ignore parse errors; other checks cover broken profile
    }
  }
  if (
    !existsSync(
      path.join(dshHome, "profiles/sdk/node_modules/@deepseek-ai/dsh-mcp-client"),
    )
  ) {
    issues.push({
      code: "mcp_client_uninstalled",
      message:
        "@deepseek-ai/dsh-mcp-client is not installed in the sdk profile node_modules",
      fix: "pnpm --filter @squadrons/host dsh:link",
    });
  }

  for (const plugin of SQUADRONS_DSH_PLUGINS) {
    if (bundles.length > 0 && !bundles.includes(plugin)) {
      issues.push({
        code: "plugin_not_bundled",
        message: `Profile bundles omit ${plugin}`,
        fix: "pnpm --filter @squadrons/host dsh:repair",
      });
    }

    const dir = pluginPackageDir(plugin);
    if (!existsSync(path.join(dir, "index.js"))) {
      issues.push({
        code: "plugin_missing",
        message: `Cordis plugin package missing: packages/${plugin}`,
      });
      continue;
    }

    const ok = canImportDshTools(dir);
    if (!ok) {
      issues.push({
        code: "plugin_peer_unresolved",
        message: `${plugin} cannot resolve @deepseek-ai/dsh-tools from packages/${plugin} (linked plugins break the whole dsh tree and initialize falsely reports openrouter NO_ADAPTER)`,
        fix: "From repo root: pnpm install (dsh-tools must be a dependency of the plugin package so packages/<name>/node_modules gets linked)",
      });
    }
  }

  return {
    ok: issues.length === 0,
    dshHome,
    usingWorkspaceHome,
    issues,
    checkedAt: Date.now(),
  };
}

export function formatPreflightFailure(result: DshPreflightResult): string {
  const lines = [
    "dsh preflight failed — refusing to start a broken plugin tree:",
    ...result.issues.map(
      (issue) =>
        `- [${issue.code}] ${issue.message}${issue.fix ? ` → ${issue.fix}` : ""}`,
    ),
  ];
  return lines.join("\n");
}

/** Rewrite the misleading SDK NO_ADAPTER error when the tree is the real cause. */
export function explainDshInitError(
  error: unknown,
  preflight?: DshPreflightResult | null,
): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("no adapter registered for provider")) {
    return error instanceof Error ? error : new Error(message);
  }

  const peerIssues =
    preflight?.issues.filter((i) => i.code === "plugin_peer_unresolved") ?? [];
  if (peerIssues.length > 0) {
    return new Error(
      `dsh plugin tree failed to load (${peerIssues.map((i) => i.message).join("; ")}). This often surfaces as: ${message}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  return new Error(
    `${message}. This is usually a dead Cordis plugin tree (broken linked plugin / wrong DSH_HOME), not a missing OpenRouter adapter. Run: pnpm --filter @squadrons/host dsh:check`,
    { cause: error instanceof Error ? error : undefined },
  );
}
