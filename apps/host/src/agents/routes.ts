import { mkdir } from "node:fs/promises";
import type { Express, NextFunction, Request, Response } from "express";
import type { CreateAgentInput, UpdateAgentInput } from "@squadrons/shared";
import {
  extractStrategyDraftFromText,
  isAgentMode,
  isAvatarId,
  isOrbColorId,
  isSupportedChainId,
  parseStrategyDraftInput,
} from "@squadrons/shared";
import {
  AuthError,
  requireUser,
  type UserStore,
} from "../auth/privy.js";
import {
  abortAgentRuntime,
  invalidateAgentRuntime,
  runDshTurn,
} from "../dsh/runner.js";
import type { ActivityHub } from "./activity-hub.js";
import type { MessageStore } from "./messages.js";
import { agentWorkspacePath } from "./paths.js";
import type { AgentStore } from "./store.js";
import type { StrategyStore } from "./strategy-store.js";

const GREETING =
  "Hey — I'm ready when you are. What should we dig into?";

export function registerAgentRoutes(
  app: Express,
  agents: AgentStore,
  messages: MessageStore,
  activity: ActivityHub,
  users: UserStore,
  strategies: StrategyStore,
): void {
  app.get("/v1/me", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      res.json({
        ok: true,
        userId: user.id,
        walletAddress: user.walletAddress,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
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
      const agent = agents.create(user.id, {
        name: String(body.name ?? ""),
        avatarId: body.avatarId as CreateAgentInput["avatarId"],
        colorId,
        description: String(body.description ?? ""),
        chainId: rawChain as CreateAgentInput["chainId"],
      });

      const workspace = agentWorkspacePath(user.id, agent.id);
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

  app.get("/v1/agents", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const list = agents.listByUser(user.id).map((agent) => ({
        ...agent,
        workspace: agentWorkspacePath(user.id, agent.id),
      }));
      res.json({ ok: true, agents: list });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      res.json({
        ok: true,
        agent: {
          ...agent,
          workspace: agentWorkspacePath(user.id, agent.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/agents/:id", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const body = req.body as Partial<UpdateAgentInput> & {
        chainId?: number | string;
        avatarId?: string;
        colorId?: string;
        mode?: string;
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
      if (body.mode !== undefined) {
        const mode = String(body.mode);
        if (!isAgentMode(mode)) {
          res.status(400).json({ ok: false, error: "invalid mode" });
          return;
        }
        patch.mode = mode;
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
        patch.chainId === undefined &&
        patch.mode === undefined
      ) {
        res.status(400).json({ ok: false, error: "no settings to update" });
        return;
      }

      const chainChanged =
        patch.chainId !== undefined && patch.chainId !== existing.chainId;
      const modeChanged =
        patch.mode !== undefined && patch.mode !== existing.mode;

      const agent = agents.updateSettings(user.id, agentId, patch);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      if (chainChanged || modeChanged) {
        await invalidateAgentRuntime(agent.id);
      }

      res.json({
        ok: true,
        agent: {
          ...agent,
          workspace: agentWorkspacePath(user.id, agent.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id/messages", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      res.json({
        ok: true,
        messages: messages.listByAgent(agent.id),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id/activity", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const limitRaw = Number(req.query.limit ?? 100);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 100;
      res.json({
        ok: true,
        activity: activity.list(agent.id, limit),
      });
    } catch (error) {
      next(error);
    }
  });

  /** Live activity stream (SSE). Client should load history via GET /activity first. */
  app.get("/v1/agents/:id/events", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const write = (eventName: string, data: unknown) => {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      write("ready", { agentId: agent.id });

      const unsubscribe = activity.subscribe(agent.id, (event) => {
        write("activity", event);
      });

      const heartbeat = setInterval(() => {
        res.write(`: ping\n\n`);
      }, 25_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.on("close", close);
    } catch (error) {
      next(error);
    }
  });

  /** Upsert a strategy draft (Operate mode only). */
  app.put("/v1/agents/:id/strategy/draft", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      if (existing.mode !== "operate") {
        res.status(400).json({
          ok: false,
          error: "switch to Operate mode before drafting a strategy",
        });
        return;
      }

      const draft = parseStrategyDraftInput(req.body);
      if (!draft) {
        res.status(400).json({ ok: false, error: "invalid strategy draft" });
        return;
      }

      strategies.upsertDraft(existing.id, draft);
      activity.publish({
        agentId: existing.id,
        kind: "info",
        label: "Saved strategy draft",
        detail: draft.summary,
      });

      const agent = agents.getForUser(user.id, existing.id);
      res.json({
        ok: true,
        agent: agent
          ? {
              ...agent,
              workspace: agentWorkspacePath(user.id, agent.id),
            }
          : {
              ...existing,
              strategy: strategies.get(existing.id),
              workspace: agentWorkspacePath(user.id, existing.id),
            },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/arm", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      if (existing.mode !== "operate") {
        res.status(400).json({
          ok: false,
          error: "switch to Operate mode before arming a strategy",
        });
        return;
      }

      const strategy = strategies.arm(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
        label: "Armed strategy",
        detail: strategy.summary,
      });

      const agent = agents.getForUser(user.id, existing.id);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace: agentWorkspacePath(user.id, existing.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/pause", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const strategy = strategies.pause(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
        label: "Paused strategy",
        detail: strategy.summary,
      });

      const agent = agents.getForUser(user.id, existing.id);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace: agentWorkspacePath(user.id, existing.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/resume", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      if (existing.mode !== "operate") {
        res.status(400).json({
          ok: false,
          error: "switch to Operate mode before resuming a strategy",
        });
        return;
      }

      const strategy = strategies.resume(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
        label: "Resumed strategy",
        detail: strategy.summary,
      });

      const agent = agents.getForUser(user.id, existing.id);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace: agentWorkspacePath(user.id, existing.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/disarm", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const strategy = strategies.disarm(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
        label: "Disarmed strategy",
        detail: strategy.summary,
      });

      const agent = agents.getForUser(user.id, existing.id);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace: agentWorkspacePath(user.id, existing.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /** Halt a working agent by killing its dsh runtime; status → paused. */
  app.post("/v1/agents/:id/pause", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      await abortAgentRuntime(existing.id);
      const agent = agents.setStatus(user.id, existing.id, "paused");
      activity.publish({
        agentId: existing.id,
        kind: "info",
        label: "Stopped",
      });

      res.json({
        ok: true,
        agent: agent
          ? {
              ...agent,
              workspace: agentWorkspacePath(user.id, agent.id),
            }
          : {
              ...existing,
              status: "paused" as const,
              workspace: agentWorkspacePath(user.id, existing.id),
            },
      });
    } catch (error) {
      next(error);
    }
  });

  /** Chat turn: append user message, run dsh, append reply. */
  app.post("/v1/agents/:id/messages", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      let agent = agents.getForUser(user.id, agentId);
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
      const priorMessages = messages.listByAgent(agent.id).filter(
        (m) => m.id !== userMessage.id,
      );

      agents.setStatus(user.id, agent.id, "working");
      agent = agents.getForUser(user.id, agent.id) ?? agent;

      const workspace = agentWorkspacePath(user.id, agent.id);

      let turn;
      try {
        turn = await runDshTurn({
          agentId: agent.id,
          agent,
          userText: content,
          workspace,
          walletAddress: user.walletAddress,
          history: priorMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          onActivity: (event) => {
            activity.publish(event);
          },
        });
      } catch (error) {
        const current = agents.getForUser(user.id, agent.id);
        if (current?.status !== "paused") {
          agents.setStatus(user.id, agent.id, "paused");
          activity.publish({
            agentId: agent.id,
            kind: "error",
            label: "Something went wrong",
            detail: null,
          });
        }
        throw error;
      }

      const replyText = (turn.finalResponse || "(no response)").trimEnd();

      if (agent.mode === "operate") {
        const draft = extractStrategyDraftFromText(replyText);
        if (draft) {
          try {
            strategies.upsertDraft(agent.id, draft);
            activity.publish({
              agentId: agent.id,
              kind: "info",
              label: "Saved strategy draft",
              detail: draft.summary,
            });
          } catch (error) {
            console.error("[strategy-draft]", agent.id, error);
          }
        }
      }

      const assistantMessage = messages.append(
        agent.id,
        "assistant",
        replyText || "(empty response)",
      );

      const updated = agents.updateAfterRun(user.id, agent.id, {
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
  if (error instanceof AuthError) {
    res.status(401).json({ ok: false, error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const status =
    /required|invalid|unsupported|cannot|no settings/i.test(message)
      ? 400
      : 500;
  if (status >= 500) console.error("[agents]", error);
  res.status(status).json({ ok: false, error: message });
}
