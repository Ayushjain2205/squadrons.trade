#!/usr/bin/env node
/**
 * Minimal stdio MCP server — run_backtest → simulated equity artifact.
 * Speaks MCP JSON-RPC as newline-delimited JSON (current MCP SDK stdio).
 */
import { createInterface } from "node:readline";
import { runSimulation } from "./simulate.mjs";

const SERVER_INFO = {
  name: "squadrons-backtest",
  version: "0.0.1",
};

const TOOLS = [
  {
    name: "run_backtest",
    description:
      "Run a simulated strategy backtest and return a chart-ready equity curve plus summary stats. Use when the user asks to backtest, paper-simulate, or chart historical performance. Engine is simulation today (Tenderly later).",
    inputSchema: {
      type: "object",
      properties: {
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
    },
  },
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function ok(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function handle(message) {
  if (!message || typeof message !== "object") return;
  const { id, method, params } = message;

  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }

  if (id === undefined || id === null) return;

  switch (method) {
    case "initialize":
      ok(id, {
        // Echo client version when supported; fall back to a known-good version.
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    case "tools/list":
    case "tools/listTools":
      ok(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (name !== "run_backtest") {
        fail(id, -32601, `Unknown tool: ${name}`);
        return;
      }
      try {
        const artifact = runSimulation(args);
        ok(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(artifact),
            },
          ],
          structuredContent: artifact,
        });
      } catch (err) {
        fail(
          id,
          -32000,
          err instanceof Error ? err.message : "Backtest failed",
        );
      }
      return;
    }
    case "ping":
      ok(id, {});
      return;
    default:
      fail(id, -32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handle(JSON.parse(trimmed));
  } catch (err) {
    process.stderr.write(
      `[squadrons-backtest] bad request: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
});
