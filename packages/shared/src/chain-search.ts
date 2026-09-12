/** Structured chain-search artifact — Graph results → chat results card. */

export const CHAIN_SEARCH_ARTIFACT_KIND = "squadrons.chain-search" as const;

export type ChainSearchHitKind =
  | "subgraph"
  | "pool"
  | "token"
  | "contract"
  | "entity"
  | "other";

export type ChainSearchHit = {
  title: string;
  subtitle?: string;
  kind: ChainSearchHitKind;
  chainId?: number;
  subgraphId?: string;
  /** Short metric labels shown on the card (e.g. "Vol $1.2M"). */
  metrics?: string[];
  url?: string;
};

export type ChainSearchArtifact = {
  kind: typeof CHAIN_SEARCH_ARTIFACT_KIND;
  version: 1;
  /** Source: The Graph Subgraph MCP / Network. */
  engine: "the-graph";
  query: string;
  title: string;
  summary: string;
  hits: ChainSearchHit[];
  notes?: string[];
};

export function isChainSearchArtifact(
  value: unknown,
): value is ChainSearchArtifact {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.kind !== CHAIN_SEARCH_ARTIFACT_KIND || row.version !== 1) {
    return false;
  }
  if (typeof row.query !== "string" || typeof row.title !== "string") {
    return false;
  }
  if (typeof row.summary !== "string") return false;
  if (!Array.isArray(row.hits) || row.hits.length < 1) return false;
  return true;
}

export function isChainSearchPublishToolName(
  toolName: string | null | undefined,
): boolean {
  if (!toolName) return false;
  return (
    toolName === "publish_chain_search" ||
    toolName.endsWith("__publish_chain_search")
  );
}

/** Pull a chain-search artifact out of tool-result text / JSON. */
export function parseChainSearchArtifact(
  raw: unknown,
): ChainSearchArtifact | null {
  if (isChainSearchArtifact(raw)) return raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isChainSearchArtifact(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const nested =
        (parsed as { artifact?: unknown; result?: unknown }).artifact ??
        (parsed as { result?: unknown }).result;
      if (isChainSearchArtifact(nested)) return nested;
    }
  } catch {
    // fall through
  }

  const start = trimmed.indexOf(`{"kind":"${CHAIN_SEARCH_ARTIFACT_KIND}"`);
  const alt = trimmed.indexOf(`{"kind": "${CHAIN_SEARCH_ARTIFACT_KIND}"`);
  const idx = start >= 0 ? start : alt;
  if (idx < 0) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(idx));
    return isChainSearchArtifact(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Cap hit count for SSE / SQLite detail payloads. */
export function compactChainSearchArtifact(
  artifact: ChainSearchArtifact,
  maxHits = 12,
): ChainSearchArtifact {
  return {
    ...artifact,
    hits: artifact.hits.slice(0, maxHits).map((hit) => ({
      ...hit,
      metrics: hit.metrics?.slice(0, 4),
    })),
  };
}
