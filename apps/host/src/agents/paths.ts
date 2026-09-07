import path from "node:path";
import { hostRoot } from "../db.js";

/** Isolated dsh cwd for one agent. */
export function agentWorkspacePath(userId: string, agentId: string): string {
  return path.join(hostRoot, "data", "tenants", userId, "agents", agentId);
}
