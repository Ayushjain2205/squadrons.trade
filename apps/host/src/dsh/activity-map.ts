import type { ActivityKind } from "@squadrons/shared";
import type { NewActivityEvent } from "../agents/activity.js";

type HarnessNotification = {
  method: string;
  params: Record<string, unknown>;
};

const TOOL_LABELS: Record<string, string> = {
  get_wallet_balances: "Checking wallet balances",
  web_search: "Searching the web",
  WebSearch: "Searching the web",
  todo_write: "Updating todos",
  todo_read: "Reading todos",
  ask_user_question: "Asking a question",
  skill: "Using a skill",
  Goal: "Updating goal",
  goal: "Updating goal",
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `Using ${name}`;
}

function truncate(text: string, max = 220): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function extractTextFromBlocks(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const row = block as Record<string, unknown>;
    if (typeof row.text === "string") parts.push(row.text);
    else if (typeof row.content === "string") parts.push(row.content);
  }
  return parts.join("\n");
}

/**
 * Map a dsh harness notification into zero or one product activity events.
 * Skips noisy chunk / status traffic.
 */
export function mapNotificationToActivity(
  agentId: string,
  notification: HarnessNotification,
): NewActivityEvent | null {
  if (notification.method !== "session.event") return null;
  const event = notification.params.event;
  if (!event || typeof event !== "object") return null;
  const typed = event as { type?: string; data?: Record<string, unknown> };
  const type = typed.type;
  const data = typed.data ?? {};

  switch (type) {
    case "turn/start":
      return {
        agentId,
        kind: "turn_start" satisfies ActivityKind,
        label: "Working…",
      };
    case "turn/end": {
      const reason = data.reason as { kind?: string } | undefined;
      if (reason?.kind === "error") {
        return {
          agentId,
          kind: "error",
          label: "Turn ended with an error",
        };
      }
      return {
        agentId,
        kind: "turn_end",
        label: "Turn finished",
      };
    }
    case "tool/call": {
      const name = typeof data.name === "string" ? data.name : "tool";
      const args =
        typeof data.arguments === "string" ? truncate(data.arguments, 160) : null;
      return {
        agentId,
        kind: "tool_call",
        label: toolLabel(name),
        detail: args,
        toolName: name,
      };
    }
    case "tool/result": {
      const message = data.message as
        | { name?: string; content?: unknown; toolCallId?: string }
        | undefined;
      const name =
        typeof message?.name === "string"
          ? message.name
          : typeof data.name === "string"
            ? data.name
            : "tool";
      const body = truncate(extractTextFromBlocks(message?.content) || "");
      const errored = Boolean(data.error);
      return {
        agentId,
        kind: errored ? "error" : "tool_result",
        label: errored ? `${toolLabel(name)} failed` : `${toolLabel(name)} · done`,
        detail: body || null,
        toolName: name,
      };
    }
    default:
      return null;
  }
}
