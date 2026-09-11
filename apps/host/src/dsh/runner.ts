import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DeepSeekHarness } from "@deepseek-ai/dsh-sdk-client";
import type { Agent } from "@squadrons/shared";
import { hostRoot } from "../db.js";
import {
  buildAgentTurnPrompt,
  buildContinuingTurnPrompt,
  buildSelfImprovementPrompt,
  LLM_PATCH_PATH,
  OBSERVE_PATCH_PATH,
} from "./prompt.js";
import { mapNotificationToActivity } from "./activity-map.js";
import type { NewActivityEvent } from "../agents/activity.js";
import type { Strategy } from "@squadrons/shared";
import type { HarnessNotification } from "./activity-map.js";
import {
  explainDshInitError,
  resolveDshHome,
  runDshPreflight,
  type DshPreflightResult,
} from "./preflight.js";

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
  /** Stable pool key — usually agent id. */
  agentId: string;
  /**
   * Optional harness pool key. Defaults to agentId.
   * Strategy ticks use a separate key so they don't share the chat session.
   */
  poolKey?: string;
  agent: Agent;
  userText: string;
  workspace: string;
  provider?: string;
  model?: string;
  /** Extra Cordis patches beyond the Squadrons LLM patch. */
  patches?: string[];
  /** Per-agent MCP secret env injected into the dsh child (never logged). */
  pluginEnv?: Record<string, string>;
  /** Hash of enabled MCP config — pool rebuilds when this changes. */
  pluginsHash?: string;
  /** Display names of enabled MCP plugins (cold-start prompt). */
  enabledPluginNames?: string[];
  /** When false, skip the observe-mode tool lockdown (smoke only). */
  observeMode?: boolean;
  /**
   * Optional prior chat for cold-start after host restart (session not yet live).
   * Ignored once the pooled session is continuing.
   */
  history?: Array<{ role: string; content: string }>;
  /** Live activity sink (persist + SSE). */
  onActivity?: (event: NewActivityEvent) => void;
  /** Raw dsh notifications (e.g. mid-turn strategy draft sync). */
  onNotification?: (notification: HarnessNotification) => void;
  /** Shared per-user wallet injected as SQUADRONS_USER_WALLET. */
  walletAddress?: string | null;
  /**
   * raw = use userText as the full harness prompt (strategy ticks).
   * chat = identity wrap / continuing user message (default).
   */
  promptMode?: "chat" | "raw";
};

type PooledRuntime = {
  harness: DeepSeekHarness;
  sessionId: string | null;
  workspace: string;
  chainId: number;
  mode: string;
  walletAddress: string | null;
  provider: string;
  model: string;
  pluginsHash: string;
};

const pool = new Map<string, PooledRuntime>();
/** Serialize turns per agent so concurrent POSTs cannot interleave on one session. */
const turnLocks = new Map<string, Promise<unknown>>();

let cachedPreflight: DshPreflightResult | null = null;

export function getCachedDshPreflight(): DshPreflightResult | null {
  return cachedPreflight;
}

export async function refreshDshPreflight(): Promise<DshPreflightResult> {
  cachedPreflight = await runDshPreflight();
  return cachedPreflight;
}

async function withAgentTurnLock<T>(
  agentId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = turnLocks.get(agentId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  turnLocks.set(agentId, run);
  try {
    return await run;
  } finally {
    if (turnLocks.get(agentId) === run) turnLocks.delete(agentId);
  }
}

function resolveRoute(options: Pick<DshTurnOptions, "provider" | "model">): {
  provider: string;
  model: string;
} {
  const provider = options.provider ?? process.env.DSH_PROVIDER ?? "openrouter";
  const model =
    options.model ?? process.env.DSH_MODEL ?? "deepseek/deepseek-v4-flash";
  if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to apps/host/.env (or export it) so dsh can use OpenRouter.",
    );
  }
  return { provider, model };
}

function buildChildEnv(
  chainId: number,
  walletAddress?: string | null,
  mode?: string | null,
  pluginEnv?: Record<string, string>,
): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  delete childEnv.DSH_MODEL;
  delete childEnv.DSH_PROVIDER;
  childEnv.SQUADRONS_AGENT_CHAIN_ID = String(chainId);
  childEnv.SQUADRONS_AGENT_MODE = mode === "operate" ? "operate" : "scout";
  if (walletAddress) {
    childEnv.SQUADRONS_USER_WALLET = walletAddress;
  } else {
    delete childEnv.SQUADRONS_USER_WALLET;
  }
  if (pluginEnv) {
    for (const [key, value] of Object.entries(pluginEnv)) {
      childEnv[key] = value;
    }
  }
  return childEnv;
}

async function evict(agentId: string): Promise<void> {
  const existing = pool.get(agentId);
  if (!existing) return;
  pool.delete(agentId);
  try {
    await existing.harness.close();
  } catch (error) {
    console.error("[dsh-pool] failed to close harness", agentId, error);
  }
}

/** Drop a pooled runtime (e.g. after home-chain or plugin change). */
export async function invalidateAgentRuntime(agentId: string): Promise<void> {
  await evict(agentId);
  await evict(tickPoolKey(agentId));
  await evict(`improve:${agentId}`);
}

/**
 * Stop a live turn by closing the agent's dsh subprocess.
 * The in-flight `run()` rejects; there is no wire-level cancel in dsh SDK.
 */
export async function abortAgentRuntime(agentId: string): Promise<boolean> {
  const hadChat = pool.has(agentId);
  const hadTick = pool.has(tickPoolKey(agentId));
  await evict(agentId);
  await evict(tickPoolKey(agentId));
  return hadChat || hadTick;
}

function tickPoolKey(agentId: string): string {
  return `tick:${agentId}`;
}

/** Close every pooled harness — call on host shutdown. */
export async function closeAllAgentRuntimes(): Promise<void> {
  const ids = [...pool.keys()];
  await Promise.all(ids.map((id) => evict(id)));
}

async function ensureRuntime(
  options: DshTurnOptions,
  provider: string,
  model: string,
  patches: string[],
): Promise<PooledRuntime> {
  const poolKey = options.poolKey ?? options.agentId;
  const walletAddress = options.walletAddress ?? null;
  const mode = options.agent.mode === "operate" ? "operate" : "scout";
  const pluginsHash = options.pluginsHash ?? "";
  const existing = pool.get(poolKey);
  if (
    existing &&
    existing.workspace === options.workspace &&
    existing.chainId === options.agent.chainId &&
    existing.mode === mode &&
    existing.walletAddress === walletAddress &&
    existing.provider === provider &&
    existing.model === model &&
    existing.pluginsHash === pluginsHash
  ) {
    return existing;
  }

  if (existing) {
    await evict(poolKey);
  }

  await mkdir(options.workspace, { recursive: true });

  const harness = new DeepSeekHarness({
    profile: "sdk",
    dshHome: resolveDshHome(),
    cwd: options.workspace,
    // Subprocess cwd must match the agent workspace — tools use process.cwd().
    processCwd: options.workspace,
    provider,
    model,
    patches,
    env: buildChildEnv(
      options.agent.chainId,
      walletAddress,
      mode,
      options.pluginEnv,
    ),
    initializeTimeoutMs: 60_000,
  });
  try {
    await harness.start();
  } catch (error) {
    throw explainDshInitError(error, cachedPreflight);
  }

  const runtime: PooledRuntime = {
    harness,
    sessionId: null,
    workspace: options.workspace,
    chainId: options.agent.chainId,
    mode,
    walletAddress,
    provider,
    model,
    pluginsHash,
  };
  pool.set(poolKey, runtime);
  return runtime;
}

/**
 * Run one chat turn on a long-lived per-agent dsh harness + session.
 * The process stays warm across turns; a new session is minted only when the
 * pool entry is created (host restart, chain change, or first message).
 * Long context is compacted by dsh-base's compaction-basic plugin (sdk profile).
 */
export async function runDshTurn(
  options: DshTurnOptions,
): Promise<DshTurnResult> {
  return withAgentTurnLock(options.agentId, async () => {
    const { provider, model } = resolveRoute(options);
    const patches = [
      LLM_PATCH_PATH,
      ...(options.observeMode === false ? [] : [OBSERVE_PATCH_PATH]),
      ...(options.patches ?? []),
    ];
    const poolKey = options.poolKey ?? options.agentId;

    const runtime = await ensureRuntime(options, provider, model, patches);
    const continuing = Boolean(runtime.sessionId);
    const prompt =
      options.promptMode === "raw"
        ? options.userText
        : continuing
          ? buildContinuingTurnPrompt(options.userText, {
              mode: options.agent.mode,
            })
          : buildColdStartPrompt(options);

    let result;
    try {
      result = await runtime.harness.run(prompt, {
        sessionId: runtime.sessionId ?? undefined,
        onNotification: (notification) => {
          options.onNotification?.(notification);
          if (!options.onActivity) return;
          const mapped = mapNotificationToActivity(
            options.agentId,
            notification,
          );
          if (mapped) options.onActivity(mapped);
        },
      });
    } catch (error) {
      await evict(poolKey);
      throw error;
    }

    const turnError = findTurnError(result.events);
    if (turnError) {
      await evict(poolKey);
      throw new Error(turnError);
    }

    runtime.sessionId = result.sessionId;

    return {
      sessionId: result.sessionId,
      finalResponse: result.finalResponse,
      eventCount: result.events.length,
      notificationCount: result.notifications.length,
      workspace: options.workspace,
      provider,
      model,
    };
  });
}

/** Cadence self-improvement review — separate pool key from ticks/chat. */
export async function runDshSelfImprovement(options: {
  agent: Agent;
  strategy: Strategy;
  workspace: string;
  walletAddress?: string | null;
  recentActivity: Array<{
    label: string;
    detail: string | null;
    createdAt: number;
  }>;
  onActivity?: (event: NewActivityEvent) => void;
  onNotification?: DshTurnOptions["onNotification"];
  patches?: string[];
  pluginEnv?: Record<string, string>;
  pluginsHash?: string;
  enabledPluginNames?: string[];
}): Promise<DshTurnResult> {
  const prompt = buildSelfImprovementPrompt(
    options.agent,
    options.strategy,
    options.recentActivity,
    options.walletAddress,
  );
  return runDshTurn({
    agentId: options.agent.id,
    poolKey: `improve:${options.agent.id}`,
    agent: options.agent,
    userText: prompt,
    workspace: options.workspace,
    walletAddress: options.walletAddress,
    onActivity: options.onActivity,
    onNotification: options.onNotification,
    promptMode: "raw",
    patches: options.patches,
    pluginEnv: options.pluginEnv,
    pluginsHash: options.pluginsHash,
    enabledPluginNames: options.enabledPluginNames,
  });
}

function buildColdStartPrompt(options: DshTurnOptions): string {
  const base = buildAgentTurnPrompt(
    options.agent,
    options.userText,
    options.walletAddress,
    options.enabledPluginNames,
  );
  const history = options.history
    ?.filter((m) => m.content.trim().length > 0)
    .slice(-12);
  if (!history || history.length === 0) return base;

  const prior = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  return `${base.replace(
    /\nUser message:\n[\s\S]*$/,
    "",
  )}\n\nRecent conversation (for context after restart):\n${prior}\n\nUser message:\n${options.userText}`;
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

/** Step-1 one-off smoke helper (ephemeral workspace, no pool, no observe patch). */
export async function runDshSmoke(options: {
  prompt?: string;
  workspace?: string;
} = {}): Promise<DshTurnResult> {
  const workspace =
    options.workspace ??
    path.join(hostRoot, "data", "tenants", "smoke", `run-${Date.now()}`);
  const { provider, model } = resolveRoute({});
  await mkdir(workspace, { recursive: true });

  await using harness = new DeepSeekHarness({
    profile: "sdk",
    dshHome: resolveDshHome(),
    cwd: workspace,
    provider,
    model,
    patches: [LLM_PATCH_PATH],
    env: buildChildEnv(8453),
    initializeTimeoutMs: 60_000,
  });

  let result;
  try {
    result = await harness.run(
      options.prompt ?? "Reply with exactly: squadrons-dsh-ok",
    );
  } catch (error) {
    throw explainDshInitError(error, cachedPreflight);
  }
  const turnError = findTurnError(result.events);
  if (turnError) throw new Error(turnError);

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
