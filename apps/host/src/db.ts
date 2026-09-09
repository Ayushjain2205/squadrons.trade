import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const here = path.dirname(fileURLToPath(import.meta.url));
export const hostRoot = path.resolve(here, "..");

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured && path.isAbsolute(configured)) return configured;
  if (configured) return path.resolve(hostRoot, configured);
  return path.join(hostRoot, "data", "squadrons.db");
}

export function openDatabase(): Database.Database {
  const dbPath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_id TEXT NOT NULL,
      description TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      spend_mode TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'scout',
      current_goal TEXT,
      last_dsh_session_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agents_user_id
      ON agents (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_agent_created
      ON messages (agent_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'system',
      label TEXT NOT NULL,
      detail TEXT,
      tool_name TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activity_agent_created
      ON activity (agent_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const columns = db
    .prepare(`PRAGMA table_info(agents)`)
    .all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "color_id")) {
    db.exec(`ALTER TABLE agents ADD COLUMN color_id TEXT`);
    // Backfill from the old face→color pairing.
    db.exec(`
      UPDATE agents SET color_id = CASE avatar_id
        WHEN '01' THEN 'purple'
        WHEN '02' THEN 'blue'
        WHEN '03' THEN 'green'
        WHEN '04' THEN 'orange'
        WHEN '05' THEN 'purple'
        WHEN '06' THEN 'blue'
        WHEN '07' THEN 'green'
        WHEN '08' THEN 'orange'
        ELSE 'purple'
      END
      WHERE color_id IS NULL
    `);
  }

  // Teal was removed from the palette; map any leftovers to blue.
  db.exec(`UPDATE agents SET color_id = 'blue' WHERE color_id = 'teal'`);

  if (!columns.some((column) => column.name === "mode")) {
    db.exec(
      `ALTER TABLE agents ADD COLUMN mode TEXT NOT NULL DEFAULT 'scout'`,
    );
  }

  const activityColumns = db
    .prepare(`PRAGMA table_info(activity)`)
    .all() as Array<{ name: string }>;
  if (!activityColumns.some((column) => column.name === "source")) {
    db.exec(
      `ALTER TABLE activity ADD COLUMN source TEXT NOT NULL DEFAULT 'system'`,
    );
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS strategies (
      agent_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      recipe_id TEXT,
      params_json TEXT,
      trigger_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      caps_json TEXT NOT NULL,
      improvement_json TEXT,
      last_tick_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_strategies_status
      ON strategies (status);

    CREATE TABLE IF NOT EXISTS trade_intents (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      symbol TEXT,
      side TEXT,
      label TEXT NOT NULL,
      detail TEXT,
      reason TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trade_intents_agent_created
      ON trade_intents (agent_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS strategy_improvement_proposals (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      patch_json TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_strategy_improvement_agent
      ON strategy_improvement_proposals (agent_id, created_at DESC);
  `);

  const strategyColumns = db
    .prepare(`PRAGMA table_info(strategies)`)
    .all() as Array<{ name: string }>;
  if (!strategyColumns.some((column) => column.name === "recipe_id")) {
    db.exec(`ALTER TABLE strategies ADD COLUMN recipe_id TEXT`);
  }
  if (!strategyColumns.some((column) => column.name === "params_json")) {
    db.exec(`ALTER TABLE strategies ADD COLUMN params_json TEXT`);
  }
  if (!strategyColumns.some((column) => column.name === "improvement_json")) {
    db.exec(`ALTER TABLE strategies ADD COLUMN improvement_json TEXT`);
  }
}
