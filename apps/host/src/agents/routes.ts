import { mkdir } from "node:fs/promises";
import type { Express, NextFunction, Request, Response } from "express";
import type { CreateAgentInput } from "@squadrons/shared";
import { runDshTurn } from "../dsh/runner.js";
import { agentWorkspacePath } from "./paths.js";
import type { AgentStore } from "./store.js";

const LOCAL_DEV_USER = "local-dev";

export function resolveUserId(req: Request): string {
  const header = req.header("x-user-id")?.trim();
  return header && header.length > 0 ? header : LOCAL_DEV_USER;
}

export function registerAgentRoutes(
  app: Express,
  agents: AgentStore,
): void {
  app.post("/v1/agents", async (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const body = req.body as Partial<CreateAgentInput>;
      const agent = agents.create(userId, {
        name: String(body.name ?? ""),
        avatarId: body.avatarId as CreateAgentInput["avatarId"],
        description: String(body.description ?? ""),
        chainId: body.chainId,
      });

      const workspace = agentWorkspacePath(userId, agent.id);
      await mkdir(workspace, { recursive: true });

      res.status(201).json({
        ok: true,
        agent,
        workspace,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents", (req, res) => {
    const userId = resolveUserId(req);
    const list = agents.listByUser(userId).map((agent) => ({
      ...agent,
      workspace: agentWorkspacePath(userId, agent.id),
    }));
    res.json({ ok: true, agents: list });
  });

  app.get("/v1/agents/:id", (req, res) => {
    const userId = resolveUserId(req);
    const agentId = req.params.id;
    if (!agentId) {
      res.status(400).json({ ok: false, error: "missing agent id" });
      return;
    }

    const agent = agents.getForUser(userId, agentId);
    if (!agent) {
      res.status(404).json({ ok: false, error: "agent not found" });
      return;
    }

    res.json({
      ok: true,
      agent: {
        ...agent,
        workspace: agentWorkspacePath(userId, agent.id),
      },
    });
  });

  /**
   * Run one dsh turn in this agent's isolated workspace.
   * Thin step-2 bridge — not full goal orchestration yet.
   */
  app.post("/v1/agents/:id/run", async (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(userId, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const prompt =
        typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!prompt) {
        res.status(400).json({ ok: false, error: "prompt is required" });
        return;
      }

      const resume =
        req.body?.resume === true || req.body?.resume === "true";
      const workspace = agentWorkspacePath(userId, agent.id);

      agents.setStatus(userId, agent.id, "working");

      let turn;
      try {
        turn = await runDshTurn({
          workspace,
          prompt,
          sessionId: resume ? agent.lastDshSessionId : null,
        });
      } catch (error) {
        agents.setStatus(userId, agent.id, "paused");
        throw error;
      }

      const updated = agents.updateAfterRun(userId, agent.id, {
        status: "idle",
        lastDshSessionId: turn.sessionId,
      });

      res.json({
        ok: true,
        agent: updated
          ? { ...updated, workspace }
          : { ...agent, workspace },
        turn,
      });
    } catch (error) {
      next(error);
    }
  });
}

export function agentErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    /required|invalid|unsupported/i.test(message) ? 400 : 500;
  if (status >= 500) console.error("[agents]", error);
  res.status(status).json({ ok: false, error: message });
}
