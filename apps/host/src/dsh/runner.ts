import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeepSeekHarness } from "@deepseek-ai/dsh-sdk-client";

const here = path.dirname(fileURLToPath(import.meta.url));
const hostRoot = path.resolve(here, "../..");

export type DshSmokeResult = {
  sessionId: string;
  finalResponse: string;
  eventCount: number;
  notificationCount: number;
  workspace: string;
  provider: string;
  model: string;
};

export type DshSmokeOptions = {
  prompt?: string;
  workspace?: string;
  provider?: string;
  model?: string;
};

/**
 * Spawns one `dsh --profile sdk` worker, runs a single prompt turn, then closes.
 * This is the step-1 heart check: host ↔ dsh JSON-RPC over stdio.
 */
export async function runDshSmoke(
  options: DshSmokeOptions = {},
): Promise<DshSmokeResult> {
  const workspace =
    options.workspace ??
    path.join(hostRoot, "data", "tenants", "smoke", `run-${Date.now()}`);
  const provider = options.provider ?? process.env.DSH_PROVIDER ?? "openrouter";
  const model =
    options.model ?? process.env.DSH_MODEL ?? "deepseek/deepseek-v4-flash";
  const prompt =
    options.prompt ??
    "Reply with exactly: squadrons-dsh-ok";

  await mkdir(workspace, { recursive: true });

  await using harness = new DeepSeekHarness({
    profile: "sdk",
    cwd: workspace,
    provider,
    model,
    // Inherit host env so OPENROUTER_API_KEY reaches the child.
    env: { ...process.env },
    initializeTimeoutMs: 60_000,
  });

  const result = await harness.run(prompt);

  return {
    sessionId: result.sessionId,
    finalResponse: result.finalResponse,
    eventCount: result.events.length,
    notificationCount: result.notifications.length,
    workspace,
    provider,
    model,
  };
}
