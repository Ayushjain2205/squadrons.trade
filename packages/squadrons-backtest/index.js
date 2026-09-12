import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { backtestLastPath } from "./paths.js";
import { runSimulation } from "./simulate.mjs";

/** Cordis plugin id / package export name. */
export const name = "squadrons-backtest";
export const inject = ["tools"];

/**
 * First-party backtest tool — gated per agent via Plugins → Backtest.
 * Writes `.squadrons/backtest-last.json` so the host can fan a chart artifact
 * to the desk (same mid-turn pattern as propose_strategy).
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: "run_backtest",
      description:
        "Run a simulated strategy backtest and return a chart-ready equity curve plus summary stats (kind: squadrons.backtest). Use when the user asks to backtest, paper-simulate, or chart historical performance — including @backtest mentions. Engine is simulation today (Tenderly later).",
      parameters: {
        strategy: {
          type: "string",
          description: "Strategy label shown on the chart card.",
        },
        days: {
          type: "number",
          description: "Lookback length in days (14–365). Default 90.",
        },
        startEquity: {
          type: "number",
          description: "Starting equity in USD. Default 10000.",
        },
        seed: {
          type: "string",
          description: "Optional seed for reproducible simulation.",
        },
        annualDriftPct: {
          type: "number",
          description: "Assumed annual drift %. Default 18.",
        },
        annualVolPct: {
          type: "number",
          description: "Assumed annual volatility %. Default 35.",
        },
      },
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_args, value) => [
          {
            type: "text",
            text:
              typeof value?.summary === "string"
                ? `${value.summary}\n\n${JSON.stringify(value)}`
                : JSON.stringify(value),
          },
        ],
      },
      timeoutMs: 15_000,
      isConcurrencySafe: () => true,
      async execute(args) {
        const artifact = runSimulation({
          strategy: args.strategy,
          days: args.days,
          startEquity: args.startEquity,
          seed: args.seed,
          annualDriftPct: args.annualDriftPct,
          annualVolPct: args.annualVolPct,
        });
        const file = backtestLastPath();
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(artifact), "utf8");
        return artifact;
      },
    }),
  );
}
