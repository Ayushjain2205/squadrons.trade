import { mkdir } from "node:fs/promises";
import type { Express, NextFunction, Request, Response } from "express";
import type { CreateAgentInput, UpdateAgentInput } from "@squadrons/shared";
import { isAvatarId, isOrbColorId, isSupportedChainId } from "@squadrons/shared";
import { runDshTurn } from "../dsh/runner.js";
import { buildAgentTurnPrompt } from "../dsh/prompt.js";
import type { MessageStore } from "./messages.js";
import { agentWorkspacePath } from "./paths.js";
import type { AgentStore } from "./store.js";

const LOCAL_DEV_USER = "local-dev";

const GREETING =
  "Hey — I'm ready when you are. What should we dig into?";

export function resolveUserId(req: Request): string {
  const header = req.header("x-user-id")?.trim();
  return header && header.length > 0 ? header : LOCAL_DEV_USER;
}

export function registerAgentRoutes(
  app: Express,
  agents: AgentStore,
  messages: MessageStore,
): void {
  app.post("/v1/agents", async (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const body = req.body as Partial<CreateAgentInput> & {
        chainId?: number | string;
        colorId?: string;
      };
      const hasChain =
        body.chainId !== undefined &&
        body.chainId !== null &&
        String(body.chainId).trim() !== "";
      const rawChain = hasChain ? Number(body.chainId) : undefined;
      if (hasChain && (rawChain === undefined || !isSupportedChainId(rawChain))) {
        res.status(400).json({ ok: false, error: "unsupported chainId" });
        return;
      }
      let colorId: CreateAgentInput["colorId"];
      if (body.colorId !== undefined) {
        const rawColor = String(body.colorId);
        if (!isOrbColorId(rawColor)) {
          res.status(400).json({ ok: false, error: "invalid colorId" });
          return;
        }
        colorId = rawColor;
      }
      const agent = agents.create(userId, {
        name: String(body.name ?? ""),
        avatarId: body.avatarId as CreateAgentInput["avatarId"],
        colorId,
        description: String(body.description ?? ""),
        chainId: rawChain,
      });

      const workspace = agentWorkspacePath(userId, agent.id);
      await mkdir(workspace, { recursive: true });

      const greeting = messages.append(agent.id, "assistant", GREETING);

      res.status(201).json({
        ok: true,
        agent: { ...agent, workspace },
        messages: [greeting],
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

  app.patch("/v1/agents/:id", (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(userId, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const body = req.body as Partial<UpdateAgentInput> & {
        chainId?: number | string;
        avatarId?: string;
        colorId?: string;
      };
      const patch: UpdateAgentInput = {};

      if (body.name !== undefined) patch.name = String(body.name);
      if (body.description !== undefined) {
        patch.description = String(body.description);
      }
      if (body.avatarId !== undefined) {
        const avatar = String(body.avatarId);
        if (!isAvatarId(avatar)) {
          res.status(400).json({ ok: false, error: "invalid avatarId" });
          return;
        }
        patch.avatarId = avatar;
      }
      if (body.colorId !== undefined) {
        const color = String(body.colorId);
        if (!isOrbColorId(color)) {
          res.status(400).json({ ok: false, error: "invalid colorId" });
          return;
        }
        patch.colorId = color;
      }
      if (
        body.chainId !== undefined &&
        body.chainId !== null &&
        String(body.chainId).trim() !== ""
      ) {
        const rawChain = Number(body.chainId);
        if (!isSupportedChainId(rawChain)) {
          res.status(400).json({ ok: false, error: "unsupported chainId" });
          return;
        }
        patch.chainId = rawChain;
      }

      if (
        patch.name === undefined &&
        patch.description === undefined &&
        patch.avatarId === undefined &&
        patch.colorId === undefined &&
        patch.chainId === undefined
      ) {
        res.status(400).json({ ok: false, error: "no settings to update" });
        return;
      }

      const agent = agents.updateSettings(userId, agentId, patch);
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
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id/messages", (req, res) => {
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
      messages: messages.listByAgent(agent.id),
    });
  });

  /** Chat turn: append user message, run dsh, append reply. */
  app.post("/v1/agents/:id/messages", async (req, res, next) => {
    try {
      const userId = resolveUserId(req);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      let agent = agents.getForUser(userId, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content) {
        res.status(400).json({ ok: false, error: "content is required" });
        return;
      }

      const userMessage = messages.append(agent.id, "user", content);

      agents.setStatus(userId, agent.id, "working");
      agent = agents.getForUser(userId, agent.id) ?? agent;

      const workspace = agentWorkspacePath(userId, agent.id);
      const prompt = buildAgentTurnPrompt(agent, content);

      let turn;
      try {
        turn = await runDshTurn({
          workspace,
          prompt,
          chainId: agent.chainId,
          sessionId: agent.lastDshSessionId,
        });
      } catch (error) {
        agents.setStatus(userId, agent.id, "paused");
        throw error;
      }

      const replyText = (turn.finalResponse || "(no response)").trimEnd();

      const assistantMessage = messages.append(
        agent.id,
        "assistant",
        replyText || "(empty response)",
      );

      const updated = agents.updateAfterRun(userId, agent.id, {
        status: "idle",
        lastDshSessionId: turn.sessionId,
      });

      res.json({
        ok: true,
        agent: updated
          ? { ...updated, workspace }
          : { ...agent, workspace },
        messages: [userMessage, assistantMessage],
        turn: {
          ...turn,
          finalResponse: replyText,
        },
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
    /required|invalid|unsupported|cannot|no settings/i.test(message)
      ? 400
      : 500;
  if (status >= 500) console.error("[agents]", error);
  res.status(status).json({ ok: false, error: message });
}
