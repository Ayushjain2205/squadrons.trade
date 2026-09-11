import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load apps/host/.env even if the process was started from the monorepo root.
const hostRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(hostRoot, ".env") });

import cors from "cors";
import express from "express";
import {
  AGENT_AVATARS,
  AGENT_COLORS,
  DEFAULT_POLICY,
  SUPPORTED_CHAINS,
} from "@squadrons/shared";
import {
  agentErrorHandler,
  registerAgentRoutes,
} from "./agents/routes.js";
import { ActivityStore } from "./agents/activity.js";
import { ActivityHub } from "./agents/activity-hub.js";
import { MessageStore } from "./agents/messages.js";
import { AgentStore } from "./agents/store.js";
import { StrategyStore } from "./agents/strategy-store.js";
import { UserStore } from "./auth/privy.js";
import { openDatabase } from "./db.js";
import { closeAllAgentRuntimes, runDshSmoke, refreshDshPreflight } from "./dsh/runner.js";
import {
  formatPreflightFailure,
  type DshPreflightResult,
} from "./dsh/preflight.js";
import { startStrategyScheduler } from "./strategy/scheduler.js";
import { startImprovementScheduler } from "./strategy/improvement.js";
import { ImprovementProposalStore } from "./strategy/improvement-store.js";
import { TradeIntentStore } from "./strategy/trade-intents.js";
import { getExecutionMode } from "./strategy/executor.js";
import { isPrivyBroadcastConfigured } from "./strategy/broadcast.js";
import { isZeroExConfigured } from "./strategy/swap-build.js";
import { isTenderlyConfigured } from "./strategy/tenderly.js";
import { AgentPluginStore } from "./plugins/store.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const skipPreflight =
  process.env.SQUADRONS_DSH_SKIP_PREFLIGHT === "1" ||
  process.env.SQUADRONS_DSH_SKIP_PREFLIGHT === "true";

let dshPreflight: DshPreflightResult | null = null;
if (!skipPreflight) {
  dshPreflight = await refreshDshPreflight();
  if (!dshPreflight.ok) {
    console.error(formatPreflightFailure(dshPreflight));
    if (process.env.SQUADRONS_DSH_PREFLIGHT_STRICT !== "0") {
      console.error(
        "[host] Refusing to listen with a broken dsh tree. Fix issues above, or set SQUADRONS_DSH_SKIP_PREFLIGHT=1 to bypass (not recommended).",
      );
      process.exit(1);
    }
    console.warn(
      "[host] Continuing despite dsh preflight failures (SQUADRONS_DSH_PREFLIGHT_STRICT=0).",
    );
  } else {
    console.log(
      `[host] dsh preflight ok (home=${dshPreflight.dshHome}, plugins=${dshPreflight.issues.length === 0 ? "ready" : "n/a"})`,
    );
  }
} else {
  console.warn("[host] dsh preflight skipped (SQUADRONS_DSH_SKIP_PREFLIGHT=1)");
}

const db = openDatabase();
const strategies = new StrategyStore(db);
const improvements = new ImprovementProposalStore(db);
const agents = new AgentStore(db, strategies);
const messages = new MessageStore(db);
const users = new UserStore(db);
const activity = new ActivityHub(new ActivityStore(db));
const tradeIntents = new TradeIntentStore(db);
const plugins = new AgentPluginStore(db);
const strategyScheduler = startStrategyScheduler({
  agents,
  strategies,
  users,
  activity,
  tradeIntents,
  messages,
});
const improvementScheduler = startImprovementScheduler({
  agents,
  strategies,
  users,
  activity,
  improvements,
  plugins,
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "squadrons-host",
    chains: SUPPORTED_CHAINS,
    policy: DEFAULT_POLICY,
    executionMode: getExecutionMode(),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    privy: Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET),
    zeroex: isZeroExConfigured(),
    tenderly: isTenderlyConfigured(),
    privyBroadcast: isPrivyBroadcastConfigured(),
    dsh: dshPreflight
      ? {
          ok: dshPreflight.ok,
          home: dshPreflight.dshHome,
          usingWorkspaceHome: dshPreflight.usingWorkspaceHome,
          issues: dshPreflight.issues,
          checkedAt: dshPreflight.checkedAt,
        }
      : { ok: null, skipped: true },
  });
});

app.get("/v1/meta", (_req, res) => {
  res.json({
    avatars: AGENT_AVATARS,
    colors: AGENT_COLORS,
    chains: SUPPORTED_CHAINS,
    policy: DEFAULT_POLICY,
  });
});

registerAgentRoutes(
  app,
  agents,
  messages,
  activity,
  users,
  strategies,
  improvements,
  tradeIntents,
  plugins,
);

app.post("/v1/dsh/smoke", async (req, res) => {
  const prompt =
    typeof req.body?.prompt === "string" && req.body.prompt.trim()
      ? req.body.prompt.trim()
      : undefined;

  try {
    const result = await runDshSmoke({ prompt });
    res.json({ ok: true, result });
  } catch (error) {
    console.error("[dsh/smoke]", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.use(agentErrorHandler);

const server = app.listen(port, host, () => {
  console.log(`squadrons-host listening on http://${host}:${port}`);
});

async function shutdown(signal: string) {
  console.log(`[host] ${signal} — closing strategy scheduler + dsh runtimes`);
  strategyScheduler.stop();
  improvementScheduler.stop();
  server.close();
  await closeAllAgentRuntimes();
  process.exit(0);
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
