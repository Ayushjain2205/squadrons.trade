import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  compactChainSearchArtifact,
  isChainSearchArtifact,
  type ChainSearchArtifact,
} from "@squadrons/shared";

const LAST_FILE = path.join(".squadrons", "chain-search-last.json");

export function chainSearchLastFile(workspace: string): string {
  return path.join(workspace, LAST_FILE);
}

/** Read the latest chain-search artifact written by publish_chain_search. */
export async function readPendingChainSearch(
  workspace: string,
): Promise<ChainSearchArtifact | null> {
  try {
    const raw = await readFile(chainSearchLastFile(workspace), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isChainSearchArtifact(parsed)) return null;
    return compactChainSearchArtifact(parsed);
  } catch {
    return null;
  }
}

export async function clearPendingChainSearch(
  workspace: string,
): Promise<void> {
  try {
    await unlink(chainSearchLastFile(workspace));
  } catch {
    // ignore
  }
}
