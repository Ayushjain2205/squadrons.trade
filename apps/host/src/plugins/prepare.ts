import { existsSync } from "node:fs";
import path from "node:path";
import { resolveDshHome } from "../dsh/preflight.js";
import type { AgentPluginStore } from "./store.js";
import { buildAgentMcpPatch } from "./mcp-patch.js";

export type PreparedAgentPlugins = {
  patches: string[];
  pluginEnv: Record<string, string>;
  pluginsHash: string;
  /** Catalog / custom display names for the identity prompt. */
  enabledNames: string[];
};

function mcpBridgeRevision(): string {
  const dshHome = resolveDshHome();
  const mcpClient = existsSync(
    path.join(dshHome, "profiles/sdk/node_modules/@deepseek-ai/dsh-mcp-client"),
  );
  const backtest = existsSync(
    path.join(dshHome, "profiles/sdk/node_modules/squadrons-backtest"),
  );
  // Bump when first-party plugin loading changes so pooled harnesses rebuild.
  return `plugins-${mcpClient ? "mcp1" : "mcp0"}-${backtest ? "bt2" : "bt0"}`;
}

/** Resolve enabled MCP plugins into Cordis patch + env for a dsh turn. */
export async function prepareAgentPlugins(
  plugins: AgentPluginStore,
  agentId: string,
  workspace: string,
): Promise<PreparedAgentPlugins> {
  const runtime = plugins.listEnabledRuntime(agentId);
  const { patchPath, env } = await buildAgentMcpPatch(workspace, runtime);
  return {
    patches: patchPath ? [patchPath] : [],
    pluginEnv: env,
    pluginsHash: `${plugins.configHash(agentId)}:${mcpBridgeRevision()}`,
    enabledNames: runtime.map((p) => p.name),
  };
}
