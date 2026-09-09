import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  draftPath,
  improvementPath,
  paramsPatchPath,
  statePath,
  tickPath,
  STRATEGY_DIR,
} from "./paths.js";
import {
  parseProposeImprovementInput,
  parseStrategyDraftInput,
  parseStrategyParamsPatch,
  parseStrategyTickDecision,
} from "./validate.js";

/** Cordis plugin id / package export name. */
export const name = "squadrons-strategy";
export const inject = ["tools"];

function deskMode() {
  const raw = String(process.env.SQUADRONS_AGENT_MODE ?? "scout").toLowerCase();
  return raw === "operate" ? "operate" : "scout";
}

async function readJson(file) {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: "propose_strategy",
      description:
        "Commit or update this agent's strategy draft (Operate mode only). Requires a built-in recipeId + params. Does not arm — the user Arms in the desk. Prefer this over dumping JSON in chat. Cannot overwrite a running strategy (pause/disarm first, or use update_strategy_params for live knobs).",
      parameters: {
        summary: {
          type: "string",
          description: "One-line mandate for the strategy.",
        },
        recipeId: {
          type: "string",
          description:
            'Built-in recipe: "balance_threshold_alert", "price_band_alert", or "price_cross_alert".',
          enum: [
            "balance_threshold_alert",
            "price_band_alert",
            "price_cross_alert",
          ],
        },
        params: {
          type: "object",
          description:
            "Recipe params. balance_threshold_alert: { walletAddress?, asset: native|ETH|USDC|WETH, op, threshold }. price_band_alert: { symbol, low, high }. price_cross_alert: { symbol, level, direction: above|below|either } — pair with trigger.type event + event price_cross.",
          additionalProperties: true,
        },
        trigger: {
          type: "object",
          description:
            'Wake config. type "interval" needs intervalSec (>=15). type "event" needs event string + optional intervalSec poll floor.',
          additionalProperties: true,
        },
        action: {
          type: "object",
          description:
            'Action config. type "alert" or "propose_trade", optional detail string. Observe agents should prefer alert.',
          additionalProperties: true,
        },
        caps: {
          type: "object",
          description: "Optional caps, e.g. { maxTradeUsd: 10 }.",
          additionalProperties: true,
        },
        improvement: {
          type: "object",
          description:
            'Optional self-improvement: { enabled, cadence: hourly|daily|weekly, allowedKeys?: string[] }. Patches are propose-only until approved.',
          additionalProperties: true,
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: "text",
            text: JSON.stringify(value, null, 2),
          },
        ],
      },
      async execute(args) {
        if (deskMode() !== "operate") {
          throw new Error(
            "propose_strategy is only available in Operate mode. Ask the user to switch modes first.",
          );
        }

        const draft = parseStrategyDraftInput(args);
        if (!draft) {
          throw new Error(
            "Invalid strategy draft. Need summary, recipeId, params, trigger (interval|event), and action (alert|propose_trade).",
          );
        }

        const state = await readJson(statePath());
        if (state?.status === "running") {
          throw new Error(
            "A strategy is already running. Pause or disarm before a full re-propose, or call update_strategy_params to change knobs live.",
          );
        }

        const dir = path.join(process.cwd(), STRATEGY_DIR);
        await mkdir(dir, { recursive: true });
        const payload = {
          ...draft,
          proposedAt: Date.now(),
        };
        await writeFile(draftPath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

        return {
          ok: true,
          status: "draft",
          summary: draft.summary,
          recipeId: draft.recipeId,
          note: "Draft saved. User must Arm it in the desk before it runs.",
        };
      },
      presentCall: (args) => ({
        card: "generic",
        title: "Propose strategy",
        kind: "other",
        rawInput: args,
      }),
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "update_strategy_params",
      description:
        "Patch live strategy params (Operate mode). Works while draft, paused, or running — does not change recipe, trigger, or arm state. Host validates against the recipe schema.",
      parameters: {
        params: {
          type: "object",
          description: "Partial or full params object for the current recipe.",
          additionalProperties: true,
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: "text",
            text: JSON.stringify(value, null, 2),
          },
        ],
      },
      async execute(args) {
        if (deskMode() !== "operate") {
          throw new Error(
            "update_strategy_params is only available in Operate mode.",
          );
        }
        const patch = parseStrategyParamsPatch(args);
        if (!patch) {
          throw new Error("Invalid params patch. Need { params: { ... } }.");
        }

        const state = await readJson(statePath());
        if (!state || state.status === "none") {
          throw new Error("No strategy to patch. Propose a draft first.");
        }

        const dir = path.join(process.cwd(), STRATEGY_DIR);
        await mkdir(dir, { recursive: true });
        const payload = {
          params: patch.params,
          proposedAt: Date.now(),
        };
        await writeFile(
          paramsPatchPath(),
          `${JSON.stringify(payload, null, 2)}\n`,
          "utf8",
        );

        return {
          ok: true,
          note: "Params patch saved for the host to apply.",
          params: patch.params,
        };
      },
      presentCall: (args) => ({
        card: "generic",
        title: "Update strategy params",
        kind: "other",
        rawInput: args,
      }),
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "propose_improvement",
      description:
        "Queue a self-improvement param patch for desk Approve/Dismiss. Use during a host self-improvement review, or in Operate when suggesting a retune. Does not apply params immediately.",
      parameters: {
        patch: {
          type: "object",
          description: "Param keys/values to change (must be allowed keys).",
          additionalProperties: true,
        },
        reason: {
          type: "string",
          description: "Short operator-facing reason for the change.",
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: "text",
            text: JSON.stringify(value, null, 2),
          },
        ],
      },
      async execute(args) {
        const proposal = parseProposeImprovementInput(args);
        if (!proposal) {
          throw new Error(
            "Invalid improvement. Need { patch: { ... }, reason? } with at least one key.",
          );
        }

        const state = await readJson(statePath());
        if (!state || state.status === "none") {
          throw new Error("No strategy to improve. Propose a draft first.");
        }

        const dir = path.join(process.cwd(), STRATEGY_DIR);
        await mkdir(dir, { recursive: true });
        const payload = {
          ...proposal,
          proposedAt: Date.now(),
        };
        await writeFile(
          improvementPath(),
          `${JSON.stringify(payload, null, 2)}\n`,
          "utf8",
        );

        return {
          ok: true,
          note: "Improvement proposal saved for desk Approve/Dismiss.",
          patch: proposal.patch,
          ...(proposal.reason ? { reason: proposal.reason } : {}),
        };
      },
      presentCall: (args) => ({
        card: "generic",
        title: "Propose improvement",
        kind: "other",
        rawInput: args,
      }),
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "get_strategy",
      description:
        "Read this agent's current strategy (armed/draft state from the desk, plus any pending local draft).",
      parameters: {},
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: "text",
            text: JSON.stringify(value, null, 2),
          },
        ],
      },
      async execute() {
        const state = await readJson(statePath());
        const draft = await readJson(draftPath());
        /** @type {Record<string, unknown>} */
        const out = { mode: deskMode() };
        if (state != null) out.strategy = state;
        if (draft != null) out.pendingDraft = draft;
        return out;
      },
      presentCall: () => ({
        card: "generic",
        title: "Get strategy",
        kind: "other",
        rawInput: {},
      }),
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "report_tick",
      description:
        "Legacy: report outcome of an LLM strategy tick. Prefer host deterministic recipes; only used for legacy strategies without a recipeId.",
      parameters: {
        action: {
          type: "string",
          description: 'Tick outcome: "none", "alert", or "propose_trade".',
          enum: ["none", "alert", "propose_trade"],
        },
        label: {
          type: "string",
          description:
            "Short operator-facing activity line (e.g. Checked balances, ETH down 5%).",
        },
        detail: {
          type: "string",
          description: "Optional extra detail for the activity trail.",
        },
        intent: {
          type: "object",
          description:
            "Required for propose_trade: { amountUsd, symbol?, side?: buy|sell, note? }.",
          additionalProperties: true,
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: "text",
            text: JSON.stringify(value, null, 2),
          },
        ],
      },
      async execute(args) {
        const decision = parseStrategyTickDecision(args);
        if (!decision) {
          throw new Error(
            'Invalid tick report. Need action "none"|"alert"|"propose_trade" (with intent.amountUsd for trades) and a short label.',
          );
        }

        const state = await readJson(statePath());
        if (state?.status !== "running") {
          throw new Error(
            "report_tick is only for armed running strategies during a host tick.",
          );
        }

        const dir = path.join(process.cwd(), STRATEGY_DIR);
        await mkdir(dir, { recursive: true });
        const payload = {
          ...decision,
          reportedAt: Date.now(),
        };
        await writeFile(tickPath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

        return {
          ok: true,
          action: decision.action,
          label: decision.label,
          ...(decision.detail ? { detail: decision.detail } : {}),
          ...(decision.intent ? { intent: decision.intent } : {}),
          note: "Tick reported to the host activity trail.",
        };
      },
      presentCall: (args) => ({
        card: "generic",
        title: "Report tick",
        kind: "other",
        rawInput: args,
      }),
    }),
  );
}
