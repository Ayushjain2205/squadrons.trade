import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DeepSeekHarness } from "@deepseek-ai/dsh-sdk-client";
import { hostRoot } from "../db.js";
import { OBSERVE_PATCH_PATH } from "./prompt.js";

export type DshTurnResult = {
  sessionId: string;
  finalResponse: string;
  eventCount: number;
  notificationCount: number;
  workspace: string;
  provider: string;
  model: string;
};

export type DshTurnOptions = {
  prompt: string;
  workspace: string;
  sessionId?: string | null;
  provider?: string;
  model?: string;
  /** Extra Cordis patches (defaults to Squadrons observe patch). */
  patches?: string[];
};

/**
 * Spawns one `dsh --profile sdk` worker for a workspace, runs a prompt turn, then closes.
 */
export async function runDshTurn(
  options: DshTurnOptions,
): Promise<DshTurnResult> {
  const provider = options.provider ?? process.env.DSH_PROVIDER ?? "openrouter";
  const model =
    options.model ?? process.env.DSH_MODEL ?? "deepseek/deepseek-v4-flash";
  const patches = options.patches ?? [OBSERVE_PATCH_PATH];

  await mkdir(options.workspace, { recursive: true });

  await using harness = new DeepSeekHarness({
    profile: "sdk",
    cwd: options.workspace,
    provider,
    model,
    patches,
    env: { ...process.env },
    initializeTimeoutMs: 60_000,
  });

  const runOptions =
    options.sessionId != null && options.sessionId !== ""
      ? { sessionId: options.sessionId }
      : undefined;

  const result = await harness.run(options.prompt, runOptions);

  return {
    sessionId: result.sessionId,
    finalResponse: result.finalResponse,
    eventCount: result.events.length,
    notificationCount: result.notifications.length,
    workspace: options.workspace,
    provider,
    model,
  };
}

/** Step-1 one-off smoke helper (ephemeral workspace, no observe patch). */
export async function runDshSmoke(options: {
  prompt?: string;
  workspace?: string;
} = {}): Promise<DshTurnResult> {
  const workspace =
    options.workspace ??
    path.join(hostRoot, "data", "tenants", "smoke", `run-${Date.now()}`);
  return runDshTurn({
    workspace,
    prompt: options.prompt ?? "Reply with exactly: squadrons-dsh-ok",
    patches: [],
  });
}
