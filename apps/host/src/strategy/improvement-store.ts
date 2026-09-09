import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  StrategyImprovementProposal,
  ImprovementProposalStatus,
} from "@squadrons/shared";

type ProposalRow = {
  id: string;
  agent_id: string;
  status: string;
  patch_json: string;
  reason: string | null;
  created_at: number;
  resolved_at: number | null;
};

function rowToProposal(row: ProposalRow): StrategyImprovementProposal {
  if (
    row.status !== "pending" &&
    row.status !== "approved" &&
    row.status !== "dismissed"
  ) {
    throw new Error(`Corrupt improvement proposal status: ${row.status}`);
  }
  let patch: Record<string, unknown>;
  try {
    patch = JSON.parse(row.patch_json) as Record<string, unknown>;
  } catch {
    throw new Error("Corrupt improvement proposal patch");
  }
  return {
    id: row.id,
    agentId: row.agent_id,
    status: row.status,
    patch,
    reason: row.reason,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export class ImprovementProposalStore {
  constructor(private readonly db: Database.Database) {}

  getPending(agentId: string): StrategyImprovementProposal | null {
    const row = this.db
      .prepare(
        `SELECT * FROM strategy_improvement_proposals
         WHERE agent_id = ? AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(agentId) as ProposalRow | undefined;
    return row ? rowToProposal(row) : null;
  }

  list(
    agentId: string,
    limit = 20,
  ): StrategyImprovementProposal[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM strategy_improvement_proposals
         WHERE agent_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(agentId, limit) as ProposalRow[];
    return rows.map(rowToProposal);
  }

  create(input: {
    agentId: string;
    patch: Record<string, unknown>;
    reason?: string | null;
  }): StrategyImprovementProposal {
    const existing = this.getPending(input.agentId);
    if (existing) {
      throw new Error("a pending improvement proposal already exists");
    }
    const now = Date.now();
    const proposal: StrategyImprovementProposal = {
      id: randomUUID(),
      agentId: input.agentId,
      status: "pending",
      patch: input.patch,
      reason: input.reason?.trim() || null,
      createdAt: now,
      resolvedAt: null,
    };
    this.db
      .prepare(
        `INSERT INTO strategy_improvement_proposals (
          id, agent_id, status, patch_json, reason, created_at, resolved_at
        ) VALUES (
          @id, @agentId, @status, @patchJson, @reason, @createdAt, NULL
        )`,
      )
      .run({
        id: proposal.id,
        agentId: proposal.agentId,
        status: proposal.status,
        patchJson: JSON.stringify(proposal.patch),
        reason: proposal.reason,
        createdAt: proposal.createdAt,
      });
    return proposal;
  }

  resolve(
    agentId: string,
    proposalId: string,
    status: Exclude<ImprovementProposalStatus, "pending">,
  ): StrategyImprovementProposal | null {
    const row = this.db
      .prepare(
        `SELECT * FROM strategy_improvement_proposals
         WHERE id = ? AND agent_id = ?`,
      )
      .get(proposalId, agentId) as ProposalRow | undefined;
    if (!row) return null;
    if (row.status !== "pending") {
      throw new Error("proposal is already resolved");
    }
    const resolvedAt = Date.now();
    this.db
      .prepare(
        `UPDATE strategy_improvement_proposals
         SET status = @status, resolved_at = @resolvedAt
         WHERE id = @id AND agent_id = @agentId`,
      )
      .run({
        id: proposalId,
        agentId,
        status,
        resolvedAt,
      });
    return this.get(agentId, proposalId);
  }

  get(
    agentId: string,
    proposalId: string,
  ): StrategyImprovementProposal | null {
    const row = this.db
      .prepare(
        `SELECT * FROM strategy_improvement_proposals
         WHERE id = ? AND agent_id = ?`,
      )
      .get(proposalId, agentId) as ProposalRow | undefined;
    return row ? rowToProposal(row) : null;
  }
}
