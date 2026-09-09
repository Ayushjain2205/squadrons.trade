import type Database from "better-sqlite3";
import {
  DEFAULT_STRATEGY_IMPROVEMENT,
  isRecipeId,
  parseRecipeParams,
  parseStrategyImprovement,
  type RecipeId,
  type Strategy,
  type StrategyAction,
  type StrategyCaps,
  type StrategyImprovement,
  type StrategyStatus,
  type StrategyTrigger,
  type UpsertStrategyDraftInput,
} from "@squadrons/shared";

type StrategyRow = {
  agent_id: string;
  status: string;
  summary: string;
  recipe_id: string | null;
  params_json: string | null;
  trigger_json: string;
  action_json: string;
  caps_json: string;
  improvement_json: string | null;
  last_tick_at: number | null;
  created_at: number;
  updated_at: number;
};

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Corrupt strategy ${label}`);
  }
}

function rowToStrategy(row: StrategyRow): Strategy {
  if (row.status !== "draft" && row.status !== "running" && row.status !== "paused") {
    throw new Error(`Corrupt strategy status: ${row.status}`);
  }

  const recipeId: RecipeId | null = isRecipeId(row.recipe_id)
    ? row.recipe_id
    : null;
  let params: Record<string, unknown> = {};
  if (row.params_json) {
    params = parseJson<Record<string, unknown>>(row.params_json, "params");
  } else if (recipeId) {
    const parsed = parseRecipeParams(recipeId, {});
    if (parsed) params = parsed;
  }

  const improvement = row.improvement_json
    ? parseStrategyImprovement(
        parseJson(row.improvement_json, "improvement"),
        Object.keys(params),
      )
    : { ...DEFAULT_STRATEGY_IMPROVEMENT, allowedKeys: Object.keys(params) };

  return {
    agentId: row.agent_id,
    status: row.status,
    summary: row.summary,
    recipeId,
    params,
    trigger: parseJson<StrategyTrigger>(row.trigger_json, "trigger"),
    action: parseJson<StrategyAction>(row.action_json, "action"),
    caps: parseJson<StrategyCaps>(row.caps_json, "caps"),
    improvement,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveImprovement(
  input: UpsertStrategyDraftInput,
  params: Record<string, unknown>,
  existing?: StrategyImprovement | null,
): StrategyImprovement {
  if (input.improvement !== undefined && input.improvement !== null) {
    return parseStrategyImprovement(input.improvement, Object.keys(params));
  }
  if (existing) return existing;
  return {
    ...DEFAULT_STRATEGY_IMPROVEMENT,
    allowedKeys: Object.keys(params),
  };
}

export class StrategyStore {
  constructor(private readonly db: Database.Database) {}

  get(agentId: string): Strategy | null {
    const row = this.db
      .prepare(`SELECT * FROM strategies WHERE agent_id = ?`)
      .get(agentId) as StrategyRow | undefined;
    return row ? rowToStrategy(row) : null;
  }

  getMany(agentIds: string[]): Map<string, Strategy> {
    const map = new Map<string, Strategy>();
    if (agentIds.length === 0) return map;

    const placeholders = agentIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT * FROM strategies WHERE agent_id IN (${placeholders})`,
      )
      .all(...agentIds) as StrategyRow[];

    for (const row of rows) {
      map.set(row.agent_id, rowToStrategy(row));
    }
    return map;
  }

  upsertDraft(agentId: string, input: UpsertStrategyDraftInput): Strategy {
    const summary = input.summary.trim();
    if (!summary) throw new Error("strategy summary is required");
    if (!isRecipeId(input.recipeId)) throw new Error("strategy recipeId is required");
    if (!input.trigger?.type) throw new Error("strategy trigger is required");
    if (!input.action?.type) throw new Error("strategy action is required");

    const params = parseRecipeParams(input.recipeId, input.params ?? {});
    if (!params) throw new Error("invalid strategy params for recipe");

    const existing = this.get(agentId);
    if (existing?.status === "running") {
      throw new Error("cannot overwrite a running strategy; pause or disarm first");
    }

    const now = Date.now();
    const caps = input.caps ?? {};
    const createdAt = existing?.createdAt ?? now;
    const improvement = resolveImprovement(
      input,
      params,
      existing?.improvement,
    );

    this.db
      .prepare(
        `INSERT INTO strategies (
          agent_id, status, summary, recipe_id, params_json,
          trigger_json, action_json, caps_json, improvement_json,
          last_tick_at, created_at, updated_at
        ) VALUES (
          @agentId, @status, @summary, @recipeId, @paramsJson,
          @triggerJson, @actionJson, @capsJson, @improvementJson,
          @lastTickAt, @createdAt, @updatedAt
        )
        ON CONFLICT(agent_id) DO UPDATE SET
          status = excluded.status,
          summary = excluded.summary,
          recipe_id = excluded.recipe_id,
          params_json = excluded.params_json,
          trigger_json = excluded.trigger_json,
          action_json = excluded.action_json,
          caps_json = excluded.caps_json,
          improvement_json = excluded.improvement_json,
          updated_at = excluded.updated_at`,
      )
      .run({
        agentId,
        status: "draft" satisfies Exclude<StrategyStatus, "none">,
        summary,
        recipeId: input.recipeId,
        paramsJson: JSON.stringify(params),
        triggerJson: JSON.stringify(input.trigger),
        actionJson: JSON.stringify(input.action),
        capsJson: JSON.stringify(caps),
        improvementJson: JSON.stringify(improvement),
        lastTickAt: existing?.lastTickAt ?? null,
        createdAt,
        updatedAt: now,
      });

    const strategy = this.get(agentId);
    if (!strategy) throw new Error("failed to persist strategy draft");
    return strategy;
  }

  /**
   * Patch params on draft / paused / running strategies (Operate live edit).
   * Does not change recipeId, trigger, or arm state.
   */
  patchParams(
    agentId: string,
    patch: Record<string, unknown>,
  ): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (!existing.recipeId) {
      throw new Error("legacy strategy has no recipe; re-propose in Operate first");
    }

    const merged = { ...existing.params, ...patch };
    const params = parseRecipeParams(existing.recipeId, merged);
    if (!params) throw new Error("invalid strategy params for recipe");

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE strategies
         SET params_json = @paramsJson, updated_at = @updatedAt
         WHERE agent_id = @agentId`,
      )
      .run({
        agentId,
        paramsJson: JSON.stringify(params),
        updatedAt,
      });

    const strategy = this.get(agentId);
    if (!strategy) throw new Error("failed to patch strategy params");
    return strategy;
  }

  /**
   * Patch self-improvement policy without changing recipe/params/arm state.
   */
  patchImprovement(
    agentId: string,
    patch: {
      enabled?: boolean;
      cadence?: "hourly" | "daily" | "weekly";
      allowedKeys?: string[];
    },
  ): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");

    const next = parseStrategyImprovement(
      {
        ...existing.improvement,
        ...patch,
        autoApply: false,
        lastRunAt: existing.improvement.lastRunAt,
      },
      Object.keys(existing.params),
    );

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE strategies
         SET improvement_json = @improvementJson, updated_at = @updatedAt
         WHERE agent_id = @agentId`,
      )
      .run({
        agentId,
        improvementJson: JSON.stringify(next),
        updatedAt,
      });

    const strategy = this.get(agentId);
    if (!strategy) throw new Error("failed to patch strategy improvement");
    return strategy;
  }

  setStatus(
    agentId: string,
    status: Exclude<StrategyStatus, "none">,
  ): Strategy | null {
    const existing = this.get(agentId);
    if (!existing) return null;

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE strategies
         SET status = @status, updated_at = @updatedAt
         WHERE agent_id = @agentId`,
      )
      .run({ agentId, status, updatedAt });

    return this.get(agentId);
  }

  arm(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (!existing.recipeId) {
      throw new Error(
        "strategy has no recipe — switch to Operate and propose a recipe-backed plan first",
      );
    }
    if (existing.status !== "draft" && existing.status !== "paused") {
      throw new Error("only draft or paused strategies can be armed");
    }
    const armed = this.setStatus(agentId, "running");
    if (!armed) throw new Error("failed to arm strategy");
    return armed;
  }

  pause(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (existing.status !== "running") {
      throw new Error("only a running strategy can be paused");
    }
    const paused = this.setStatus(agentId, "paused");
    if (!paused) throw new Error("failed to pause strategy");
    return paused;
  }

  resume(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (!existing.recipeId) {
      throw new Error(
        "strategy has no recipe — switch to Operate and propose a recipe-backed plan first",
      );
    }
    if (existing.status !== "paused") {
      throw new Error("only a paused strategy can be resumed");
    }
    const resumed = this.setStatus(agentId, "running");
    if (!resumed) throw new Error("failed to resume strategy");
    return resumed;
  }

  /** Stop live run and keep the plan as a draft. */
  disarm(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (existing.status === "draft") return existing;
    const draft = this.setStatus(agentId, "draft");
    if (!draft) throw new Error("failed to disarm strategy");
    return draft;
  }

  markTicked(agentId: string, at = Date.now()): Strategy | null {
    const existing = this.get(agentId);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE strategies
         SET last_tick_at = @at, updated_at = @at
         WHERE agent_id = @agentId`,
      )
      .run({ agentId, at });
    return this.get(agentId);
  }

  markImprovementRun(agentId: string, at = Date.now()): Strategy | null {
    const existing = this.get(agentId);
    if (!existing) return null;
    const improvement: StrategyImprovement = {
      ...existing.improvement,
      lastRunAt: at,
    };
    this.db
      .prepare(
        `UPDATE strategies
         SET improvement_json = @improvementJson, updated_at = @at
         WHERE agent_id = @agentId`,
      )
      .run({
        agentId,
        improvementJson: JSON.stringify(improvement),
        at,
      });
    return this.get(agentId);
  }

  delete(agentId: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM strategies WHERE agent_id = ?`)
      .run(agentId);
    return result.changes > 0;
  }

  listRunning(): Strategy[] {
    const rows = this.db
      .prepare(`SELECT * FROM strategies WHERE status = 'running'`)
      .all() as StrategyRow[];
    return rows.map(rowToStrategy);
  }
}
