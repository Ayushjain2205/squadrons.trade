import type { AgentPluginStore } from "./store.js";
import { buildAgentMcpPatch } from "./mcp-patch.js";

export type PreparedAgentPlugins = {
  patches: string[];
  pluginEnv: Record<string, string>;
  pluginsHash: string;
  /** Catalog / custom display names for the identity prompt. */
  enabledNames: string[];
};

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
    pluginsHash: plugins.configHash(agentId),
    enabledNames: runtime.map((p) => p.name),
  };
}
