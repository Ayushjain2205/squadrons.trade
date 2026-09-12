import path from "node:path";

export const BACKTEST_DIR = ".squadrons";
export const BACKTEST_LAST_FILE = "backtest-last.json";

export function backtestLastPath(workspace = process.cwd()) {
  return path.join(workspace, BACKTEST_DIR, BACKTEST_LAST_FILE);
}
