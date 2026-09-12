import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  compactBacktestArtifact,
  isBacktestArtifact,
  type BacktestArtifact,
} from "@squadrons/shared";

const LAST_FILE = path.join(".squadrons", "backtest-last.json");

export function backtestLastFile(workspace: string): string {
  return path.join(workspace, LAST_FILE);
}

/** Read the latest backtest artifact written by run_backtest (if any). */
export async function readPendingBacktest(
  workspace: string,
): Promise<BacktestArtifact | null> {
  try {
    const raw = await readFile(backtestLastFile(workspace), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isBacktestArtifact(parsed)) return null;
    return compactBacktestArtifact(parsed);
  } catch {
    return null;
  }
}

export async function clearPendingBacktest(workspace: string): Promise<void> {
  try {
    await unlink(backtestLastFile(workspace));
  } catch {
    // ignore
  }
}
