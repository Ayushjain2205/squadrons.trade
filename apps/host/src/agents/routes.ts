import { mkdir } from "node:fs/promises";
import type { Express, NextFunction, Request, Response } from "express";
import type { CreateAgentInput } from "@squadrons/shared";
import { runDshTurn } from "../dsh/runner.js";
import {
  buildAgentTurnPrompt,
  stripGoalCompleteMarker,
} from "../dsh/prompt.js";
import type { MessageStore } from "./messages.js";
import { agentWorkspacePath } from "./paths.js";
import type { AgentStore } from "./store.js";

const LOCAL_DEV_USER = "local-dev";

const GOAL_INTAKE_PROMPT =
  "I'm ready. What should I work on? Describe the goal in one or two sentences.";

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
      const body = req.body as Partial<CreateAgentInput>;
      const agent = agents.create(userId, {
        name: String(body.name ?? ""),
        avatarId: body.avatarId as CreateAgentInput["avatarId"],
        description: String(body.description ?? ""),
        chainId: body.chainId,
      });

      const workspace = agentWorkspacePath(userId, agent.id);
      await mkdir(workspace, { recursive: true });

      const intake = messages.append(agent.id, "assistant", GOAL_INTAKE_PROMPT);

      res.status(201).json({
        ok: true,
        agent: { ...agent, workspace },
        messages: [intake],
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

  /**
   * Chat turn: append user message, run dsh in agent workspace, append reply.
   * First user message while needs_input becomes the active goal.
   */
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

      // Goal intake: first concrete instruction becomes the goal.
      if (!agent.currentGoal) {
        agent =
          agents.setGoal(userId, agent.id, {
            currentGoal: content,
            status: "working",
          }) ?? agent;
      } else {
        agents.setStatus(userId, agent.id, "working");
        agent = agents.getForUser(userId, agent.id) ?? agent;
      }

      const workspace = agentWorkspacePath(userId, agent.id);
      const prompt = buildAgentTurnPrompt(agent, content);

      let turn;
      try {
        turn = await runDshTurn({
          workspace,
          prompt,
          sessionId: agent.lastDshSessionId,
        });
      } catch (error) {
        agents.setStatus(userId, agent.id, "paused");
        throw error;
      }

      const { content: replyText, completed } = stripGoalCompleteMarker(
        turn.finalResponse || "(no response)",
      );

      const assistantMessage = messages.append(
        agent.id,
        "assistant",
        replyText || "(empty response)",
      );

      const updated = agents.setGoal(userId, agent.id, {
        currentGoal: completed ? null : agent.currentGoal,
        status: completed ? "idle" : "working",
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
          goalCompleted: completed,
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
  const status = /required|invalid|unsupported/i.test(message) ? 400 : 500;
  if (status >= 500) console.error("[agents]", error);
  res.status(status).json({ ok: false, error: message });
}
