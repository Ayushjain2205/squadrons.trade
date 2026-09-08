import type { ActivityKind } from "@squadrons/shared";
import type { NewActivityEvent } from "../agents/activity.js";

type HarnessNotification = {
  method: string;
  params: Record<string, unknown>;
};

/** Product-facing verbs — never expose tool ids or raw args. */
const STEP_LABELS: Record<string, string> = {
  get_wallet_balances: "Looking up balances",
  get_spot_prices: "Checking prices",
  web_search: "Searching the web",
  WebSearch: "Searching the web",
  web_fetch: "Reading a page",
  todo_write: "Organizing next steps",
  todo_read: "Reviewing next steps",
  ask_user_question: "Needs your input",
  skill: "Using a playbook",
};

function stepLabel(toolName: string): string {
  return STEP_LABELS[toolName] ?? "Working on it";
}

/**
 * Map a dsh notification into at most one highly abstracted activity step.
 * Grok Bot–style: human verbs only — no turn markers, no args, no result dumps.
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
    case "tool/call": {
      const name = typeof data.name === "string" ? data.name : "tool";
      return {
        agentId,
        kind: "tool_call" satisfies ActivityKind,
        label: stepLabel(name),
        detail: null,
        toolName: name,
      };
    }
    case "tool/result": {
      // Successful results stay silent — the call already told the story.
      if (!data.error) return null;
      const message = data.message as { name?: string } | undefined;
      const name =
        typeof message?.name === "string"
          ? message.name
          : typeof data.name === "string"
            ? data.name
            : "tool";
      return {
        agentId,
        kind: "error" satisfies ActivityKind,
        label: `${stepLabel(name)} failed`,
        detail: null,
        toolName: name,
      };
    }
    case "turn/end": {
      const reason = data.reason as { kind?: string } | undefined;
      if (reason?.kind !== "error") return null;
      return {
        agentId,
        kind: "error",
        label: "Something went wrong",
        detail: null,
      };
    }
    default:
      // Skip turn/start, chunks, assistant messages, successful turn/end, etc.
      return null;
  }
}
