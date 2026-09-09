import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { draftPath, statePath, STRATEGY_DIR } from "./paths.js";
import { parseStrategyDraftInput } from "./validate.js";

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
        "Commit or update this agent's strategy draft (Operate mode only). Use when the plan is concrete enough to Arm. Does not arm or start the live loop — the user Arms in the desk. Prefer this over dumping JSON in chat.",
      parameters: {
        summary: {
          type: "string",
          description: "One-line mandate for the strategy.",
        },
        trigger: {
          type: "object",
          description:
            'Trigger config. type "interval" needs intervalSec (>=15). type "condition" needs condition string; optional intervalSec poll floor.',
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
            "Invalid strategy draft. Need summary, trigger (interval|condition), and action (alert|propose_trade).",
          );
        }

        const state = await readJson(statePath());
        if (state?.status === "running") {
          throw new Error(
            "A strategy is already running. Pause or disarm it before proposing a new draft.",
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
        return {
          mode: deskMode(),
          strategy: state,
          pendingDraft: draft,
        };
      },
      presentCall: () => ({
        card: "generic",
        title: "Get strategy",
        kind: "other",
        rawInput: {},
      }),
    }),
  );
}
