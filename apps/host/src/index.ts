import cors from "cors";
import express from "express";
import {
  AGENT_AVATARS,
  DEFAULT_POLICY,
  SUPPORTED_CHAINS,
} from "@squadrons/shared";

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
  });
});

app.get("/v1/meta", (_req, res) => {
  res.json({
    avatars: AGENT_AVATARS,
    chains: SUPPORTED_CHAINS,
    policy: DEFAULT_POLICY,
  });
});

app.listen(port, host, () => {
  console.log(`squadrons-host listening on http://${host}:${port}`);
});
