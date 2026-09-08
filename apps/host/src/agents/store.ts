import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  DEFAULT_POLICY,
  isAvatarId,
  isSupportedChainId,
  type Agent,
  type AgentStatus,
  type AvatarId,
  type CreateAgentInput,
  type SpendMode,
  type SupportedChainId,
  type UpdateAgentInput,
} from "@squadrons/shared";

type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  avatar_id: string;
  description: string;
  chain_id: number;
  status: string;
  spend_mode: string;
  current_goal: string | null;
  last_dsh_session_id: string | null;
  created_at: number;
  updated_at: number;
};

function rowToAgent(row: AgentRow): Agent {
  if (!isAvatarId(row.avatar_id)) {
    throw new Error(`Corrupt agent avatar_id: ${row.avatar_id}`);
  }
  if (!isSupportedChainId(row.chain_id)) {
    throw new Error(`Corrupt agent chain_id: ${row.chain_id}`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    avatarId: row.avatar_id,
    description: row.description,
    chainId: row.chain_id,
    status: row.status as AgentStatus,
    spendMode: row.spend_mode as SpendMode,
    currentGoal: row.current_goal,
    lastDshSessionId: row.last_dsh_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AgentStore {
  constructor(private readonly db: Database.Database) {}

  create(userId: string, input: CreateAgentInput): Agent {
    const name = input.name.trim();
    const description = input.description.trim();
    if (!name) throw new Error("name is required");
    if (!description) throw new Error("description is required");
    if (!isAvatarId(input.avatarId)) throw new Error("invalid avatarId");

    const chainId: SupportedChainId =
      input.chainId ?? DEFAULT_POLICY.defaultChainId;
    if (!isSupportedChainId(chainId)) throw new Error("unsupported chainId");

    const now = Date.now();
    const agent: Agent = {
      id: randomUUID(),
      userId,
      name,
      avatarId: input.avatarId as AvatarId,
      description,
      chainId,
      status: "needs_input",
      spendMode: "observe",
      currentGoal: null,
      lastDshSessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO agents (
          id, user_id, name, avatar_id, description, chain_id,
          status, spend_mode, current_goal, last_dsh_session_id,
          created_at, updated_at
        ) VALUES (
          @id, @userId, @name, @avatarId, @description, @chainId,
          @status, @spendMode, @currentGoal, @lastDshSessionId,
          @createdAt, @updatedAt
        )`,
      )
      .run({
        id: agent.id,
        userId: agent.userId,
        name: agent.name,
        avatarId: agent.avatarId,
        description: agent.description,
        chainId: agent.chainId,
        status: agent.status,
        spendMode: agent.spendMode,
        currentGoal: agent.currentGoal,
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
    return rows.map(rowToAgent);
  }

  getForUser(userId: string, agentId: string): Agent | null {
    const row = this.db
      .prepare(`SELECT * FROM agents WHERE id = ? AND user_id = ?`)
      .get(agentId, userId) as AgentRow | undefined;
    return row ? rowToAgent(row) : null;
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

  setGoal(
    userId: string,
    agentId: string,
    patch: {
      currentGoal: string | null;
      status: AgentStatus;
      lastDshSessionId?: string | null;
    },
  ): Agent | null {
    const existing = this.getForUser(userId, agentId);
    if (!existing) return null;

    const updatedAt = Date.now();
    const lastDshSessionId =
      patch.lastDshSessionId !== undefined
        ? patch.lastDshSessionId
        : existing.lastDshSessionId;

    this.db
      .prepare(
        `UPDATE agents
         SET current_goal = @currentGoal,
             status = @status,
             last_dsh_session_id = @lastDshSessionId,
             updated_at = @updatedAt
         WHERE id = @id AND user_id = @userId`,
      )
      .run({
        id: agentId,
        userId,
        currentGoal: patch.currentGoal,
        status: patch.status,
        lastDshSessionId,
        updatedAt,
      });

    return this.getForUser(userId, agentId);
  }

  updateAfterRun(
    userId: string,
    agentId: string,
    patch: {
      status: AgentStatus;
      lastDshSessionId: string;
      currentGoal?: string | null;
    },
  ): Agent | null {
    const existing = this.getForUser(userId, agentId);
    if (!existing) return null;

    const updatedAt = Date.now();
    const currentGoal =
      patch.currentGoal !== undefined ? patch.currentGoal : existing.currentGoal;

    this.db
      .prepare(
        `UPDATE agents
         SET status = @status,
             last_dsh_session_id = @lastDshSessionId,
             current_goal = @currentGoal,
             updated_at = @updatedAt
         WHERE id = @id AND user_id = @userId`,
      )
      .run({
        id: agentId,
        userId,
        status: patch.status,
        lastDshSessionId: patch.lastDshSessionId,
        currentGoal,
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

    if (!name) throw new Error("name is required");
    if (!description) throw new Error("description is required");
    if (!isAvatarId(avatarId)) throw new Error("invalid avatarId");

    let chainId = existing.chainId;
    let currentGoal = existing.currentGoal;
    let status = existing.status;

    if (input.chainId !== undefined && input.chainId !== existing.chainId) {
      if (!isSupportedChainId(input.chainId)) {
        throw new Error("unsupported chainId");
      }
      if (existing.status !== "idle" && existing.status !== "needs_input") {
        throw new Error(
          "cannot change chain while agent is working or paused",
        );
      }
      chainId = input.chainId;
      // Home-chain switch: drop any stale goal; keep chat history + workspace.
      if (currentGoal) {
        currentGoal = null;
        status = "needs_input";
      }
    }

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE agents
         SET name = @name,
             description = @description,
             avatar_id = @avatarId,
             chain_id = @chainId,
             current_goal = @currentGoal,
             status = @status,
             updated_at = @updatedAt
         WHERE id = @id AND user_id = @userId`,
      )
      .run({
        id: agentId,
        userId,
        name,
        description,
        avatarId,
        chainId,
        currentGoal,
        status,
        updatedAt,
      });

    return this.getForUser(userId, agentId);
  }
}
