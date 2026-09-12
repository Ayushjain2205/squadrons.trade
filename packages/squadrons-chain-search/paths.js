import path from "node:path";

export const CHAIN_SEARCH_DIR = ".squadrons";
export const CHAIN_SEARCH_LAST_FILE = "chain-search-last.json";

export function chainSearchLastPath(workspace = process.cwd()) {
  return path.join(workspace, CHAIN_SEARCH_DIR, CHAIN_SEARCH_LAST_FILE);
}
