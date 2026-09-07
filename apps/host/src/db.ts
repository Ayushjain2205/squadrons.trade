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
  `);
}
