/** Host-shared The Graph Gateway API key (never per-user). */

export function theGraphGatewayApiKey(): string | null {
  const raw =
    process.env.THE_GRAPH_GATEWAY_API_KEY?.trim() ||
    process.env.GRAPH_GATEWAY_API_KEY?.trim() ||
    "";
  return raw || null;
}

/** Authorization header value for Subgraph MCP (`Bearer …`). */
export function theGraphAuthHeader(): string | null {
  const key = theGraphGatewayApiKey();
  if (!key) return null;
  if (/^bearer\s+/i.test(key)) return key;
  return `Bearer ${key}`;
}

/** True when the host can inject Subgraph MCP for Chain Search. */
export function isChainSearchAvailable(): boolean {
  return theGraphAuthHeader() != null;
}

export const SUBGRAPH_MCP_URL = "https://subgraphs.mcp.thegraph.com/sse";
export const SUBGRAPH_MCP_SERVER_NAME = "subgraph";
export const CHAIN_SEARCH_AUTH_ENV = "SQUADRONS_THE_GRAPH_AUTH_HEADER";
