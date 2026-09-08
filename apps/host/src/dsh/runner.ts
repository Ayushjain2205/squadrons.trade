import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeepSeekHarness } from "@deepseek-ai/dsh-sdk-client";
import { hostRoot } from "../db.js";
import { LLM_PATCH_PATH, OBSERVE_PATCH_PATH } from "./prompt.js";

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
  /** Agent home chain — scopes on-chain tools for this turn. */
  chainId?: number;
  /** Extra Cordis patches beyond the Squadrons LLM patch. */
  patches?: string[];
  /** When false, skip the observe-mode tool lockdown (smoke only). */
  observeMode?: boolean;
};

function defaultDshHome(): string {
  return process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
}

/**
 * Spawns one `dsh --profile sdk` worker for a workspace, runs a prompt turn, then closes.
 */
export async function runDshTurn(
  options: DshTurnOptions,
): Promise<DshTurnResult> {
  const provider = options.provider ?? process.env.DSH_PROVIDER ?? "openrouter";
  const model =
    options.model ?? process.env.DSH_MODEL ?? "deepseek/deepseek-v4-flash";

  if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to apps/host/.env (or export it) so dsh can use OpenRouter.",
    );
  }

  const patches = [
    LLM_PATCH_PATH,
    ...(options.observeMode === false
      ? []
      : [OBSERVE_PATCH_PATH]),
    ...(options.patches ?? []),
  ];

  await mkdir(options.workspace, { recursive: true });

  // dsh discovers parent .env files; keep DSH_* out of dotenv-managed files.
  // Provider/model are passed via DeepSeekHarness options, not child env.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  delete childEnv.DSH_MODEL;
  delete childEnv.DSH_PROVIDER;
  if (options.chainId !== undefined) {
    childEnv.SQUADRONS_AGENT_CHAIN_ID = String(options.chainId);
  }

  await using harness = new DeepSeekHarness({
    profile: "sdk",
    dshHome: defaultDshHome(),
    cwd: options.workspace,
    provider,
    model,
    patches,
    env: childEnv,
    initializeTimeoutMs: 60_000,
  });

  // Always start a fresh dsh session. Each turn owns a short-lived harness
  // process; reusing lastDshSessionId across process boundaries hits:
  // "persisted log on disk that does not match this live session (id collision)"
  // and returns idle with an empty finalResponse.
  void options.sessionId;
  const result = await harness.run(options.prompt);

  const turnError = findTurnError(result.events);
  if (turnError) {
    throw new Error(turnError);
  }

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

function findTurnError(events: unknown[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i] as {
      type?: string;
      data?: { reason?: { kind?: string; error?: { message?: string } } };
    } | null;
    if (event?.type !== "turn/end") continue;
    if (event.data?.reason?.kind !== "error") return null;
    return (
      event.data.reason.error?.message ??
      "dsh turn ended with an error and no assistant reply"
    );
  }
  return null;
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
    observeMode: false,
  });
}
