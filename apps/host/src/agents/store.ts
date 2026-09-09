import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  DEFAULT_POLICY,
  isAgentMode,
  isAvatarId,
  isOrbColorId,
  isSupportedChainId,
  legacyColorForFace,
  type Agent,
  type AgentMode,
  type AgentStatus,
  type AvatarId,
  type CreateAgentInput,
  type OrbColorId,
  type SpendMode,
  type Strategy,
  type SupportedChainId,
  type UpdateAgentInput,
} from "@squadrons/shared";
import type { StrategyStore } from "./strategy-store.js";

type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  avatar_id: string;
  color_id: string | null;
  description: string;
  chain_id: number;
  status: string;
  spend_mode: string;
  mode: string | null;
  current_goal: string | null;
  last_dsh_session_id: string | null;
  created_at: number;
  updated_at: number;
};

function normalizeStatus(raw: string): AgentStatus {
  if (raw === "working") return "working";
  if (raw === "paused") return "paused";
  // Legacy needs_input / anything else → idle
  return "idle";
}

function normalizeMode(raw: string | null | undefined): AgentMode {
  return isAgentMode(raw) ? raw : "scout";
}

function rowToAgent(row: AgentRow, strategy: Strategy | null): Agent {
  if (!isAvatarId(row.avatar_id)) {
    throw new Error(`Corrupt agent avatar_id: ${row.avatar_id}`);
  }
  if (!isSupportedChainId(row.chain_id)) {
    throw new Error(`Corrupt agent chain_id: ${row.chain_id}`);
  }

  const colorId: OrbColorId =
    row.color_id && isOrbColorId(row.color_id)
      ? row.color_id
      : legacyColorForFace(row.avatar_id);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    avatarId: row.avatar_id,
    colorId,
    description: row.description,
    chainId: row.chain_id,
    status: normalizeStatus(row.status),
    spendMode: row.spend_mode as SpendMode,
    mode: normalizeMode(row.mode),
    strategy,
    lastDshSessionId: row.last_dsh_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AgentStore {
  constructor(
    private readonly db: Database.Database,
    private readonly strategies: StrategyStore,
  ) {}

  create(userId: string, input: CreateAgentInput): Agent {
    const name = input.name.trim();
    const description = input.description.trim();
    if (!name) throw new Error("name is required");
    if (!description) throw new Error("description is required");
    if (!isAvatarId(input.avatarId)) throw new Error("invalid avatarId");

    const colorId: OrbColorId =
      input.colorId ?? legacyColorForFace(input.avatarId);
    if (!isOrbColorId(colorId)) throw new Error("invalid colorId");

    const chainId: SupportedChainId =
      input.chainId ?? DEFAULT_POLICY.defaultChainId;
    if (!isSupportedChainId(chainId)) throw new Error("unsupported chainId");

    const now = Date.now();
    const agent: Agent = {
      id: randomUUID(),
      userId,
      name,
      avatarId: input.avatarId as AvatarId,
      colorId,
      description,
      chainId,
      status: "idle",
      spendMode: "observe",
      mode: "scout",
      strategy: null,
      lastDshSessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO agents (
          id, user_id, name, avatar_id, color_id, description, chain_id,
          status, spend_mode, mode, current_goal, last_dsh_session_id,
          created_at, updated_at
        ) VALUES (
          @id, @userId, @name, @avatarId, @colorId, @description, @chainId,
          @status, @spendMode, @mode, NULL, @lastDshSessionId,
          @createdAt, @updatedAt
        )`,
      )
      .run({
        id: agent.id,
        userId: agent.userId,
        name: agent.name,
        avatarId: agent.avatarId,
        colorId: agent.colorId,
        description: agent.description,
        chainId: agent.chainId,
        status: agent.status,
        spendMode: agent.spendMode,
        mode: agent.mode,
        lastDshSessionId: agent.lastDshSessionId,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      });

    return agent;
  }

  listByUser(userId: string): Agent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM agents
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(userId) as AgentRow[];
    const strategyMap = this.strategies.getMany(rows.map((row) => row.id));
    return rows.map((row) => rowToAgent(row, strategyMap.get(row.id) ?? null));
  }

  getForUser(userId: string, agentId: string): Agent | null {
    const row = this.db
      .prepare(`SELECT * FROM agents WHERE id = ? AND user_id = ?`)
      .get(agentId, userId) as AgentRow | undefined;
    if (!row) return null;
    return rowToAgent(row, this.strategies.get(agentId));
  }

  /** Host-internal lookup (strategy ticker). */
  getById(agentId: string): Agent | null {
    const row = this.db
      .prepare(`SELECT * FROM agents WHERE id = ?`)
      .get(agentId) as AgentRow | undefined;
    if (!row) return null;
    return rowToAgent(row, this.strategies.get(agentId));
  }

  setStatus(userId: string, agentId: string, status: AgentStatus): Agent | null {
    const existing = this.getForUser(userId, agentId);
    if (!existing) return null;

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE agents
         SET status = @status, updated_at = @updatedAt
         WHERE id = @id AND user_id = @userId`,
      )
      .run({ id: agentId, userId, status, updatedAt });

    return this.getForUser(userId, agentId);
  }

  updateAfterRun(
    userId: string,
    agentId: string,
    patch: {
      status: AgentStatus;
      lastDshSessionId: string;
    },
  ): Agent | null {
    const existing = this.getForUser(userId, agentId);
    if (!existing) return null;

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE agents
         SET status = @status,
             last_dsh_session_id = @lastDshSessionId,
             current_goal = NULL,
             updated_at = @updatedAt
         WHERE id = @id AND user_id = @userId`,
      )
      .run({
        id: agentId,
        userId,
        status: patch.status,
        lastDshSessionId: patch.lastDshSessionId,
        updatedAt,
      });

    return this.getForUser(userId, agentId);
  }

  updateSettings(
    userId: string,
    agentId: string,
    input: UpdateAgentInput,
  ): Agent | null {
    const existing = this.getForUser(userId, agentId);
    if (!existing) return null;

    const name =
      input.name !== undefined ? input.name.trim() : existing.name;
    const description =
      input.description !== undefined
        ? input.description.trim()
        : existing.description;
    const avatarId =
      input.avatarId !== undefined ? input.avatarId : existing.avatarId;
    const colorId =
      input.colorId !== undefined ? input.colorId : existing.colorId;

    if (!name) throw new Error("name is required");
    if (!description) throw new Error("description is required");
    if (!isAvatarId(avatarId)) throw new Error("invalid avatarId");
    if (!isOrbColorId(colorId)) throw new Error("invalid colorId");

    let chainId = existing.chainId;
    let mode = existing.mode;
    let spendMode = existing.spendMode;

    if (input.chainId !== undefined && input.chainId !== existing.chainId) {
      if (!isSupportedChainId(input.chainId)) {
        throw new Error("unsupported chainId");
      }
      if (existing.status === "working") {
        throw new Error("cannot change chain while agent is working");
      }
      chainId = input.chainId;
    }

    if (input.mode !== undefined && input.mode !== existing.mode) {
      if (!isAgentMode(input.mode)) throw new Error("invalid mode");
      if (
        input.mode === "scout" &&
        existing.strategy?.status === "running"
      ) {
        throw new Error("pause or disarm the strategy before switching to scout");
      }
      mode = input.mode;
    }

    if (input.spendMode !== undefined && input.spendMode !== existing.spendMode) {
      if (input.spendMode !== "observe" && input.spendMode !== "spend_enabled") {
        throw new Error("invalid spendMode");
      }
      spendMode = input.spendMode;
    }

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE agents
         SET name = @name,
             description = @description,
             avatar_id = @avatarId,
             color_id = @colorId,
             chain_id = @chainId,
             mode = @mode,
             spend_mode = @spendMode,
             current_goal = NULL,
             updated_at = @updatedAt
         WHERE id = @id AND user_id = @userId`,
      )
      .run({
        id: agentId,
        userId,
        name,
        description,
        avatarId,
        colorId,
        chainId,
        mode,
        spendMode,
        updatedAt,
      });

    return this.getForUser(userId, agentId);
  }
}
