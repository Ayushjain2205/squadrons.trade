import "dotenv/config";
import cors from "cors";
import express from "express";
import {
  AGENT_AVATARS,
  DEFAULT_POLICY,
  SUPPORTED_CHAINS,
} from "@squadrons/shared";
import { runDshSmoke } from "./dsh/runner.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "squadrons-host",
    chain: SUPPORTED_CHAINS[0],
    policy: DEFAULT_POLICY,
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  });
});

app.get("/v1/meta", (_req, res) => {
  res.json({
    avatars: AGENT_AVATARS,
    chains: SUPPORTED_CHAINS,
    policy: DEFAULT_POLICY,
  });
});

/**
 * Step 1 heart check: spawn dsh sdk worker, one prompt turn, return final text.
 * Local-dev only for now — no auth.
 */
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

app.listen(port, host, () => {
  console.log(`squadrons-host listening on http://${host}:${port}`);
});
