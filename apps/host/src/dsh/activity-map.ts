import {
  activityStepLabel,
  type ActivityKind,
} from "@squadrons/shared";
import type { NewActivityEvent } from "../agents/activity.js";

export type HarnessNotification = {
  method: string;
  params: Record<string, unknown>;
};

function sessionEvent(notification: HarnessNotification): {
  type?: string;
  data: Record<string, unknown>;
} | null {
  if (notification.method !== "session.event") return null;
  const event = notification.params.event;
  if (!event || typeof event !== "object") return null;
  const typed = event as { type?: string; data?: Record<string, unknown> };
  return { type: typed.type, data: typed.data ?? {} };
}

function toolNameFromData(data: Record<string, unknown>): string | null {
  if (typeof data.name === "string") return data.name;
  const message = data.message as { name?: string } | undefined;
  if (typeof message?.name === "string") return message.name;
  return null;
}

/**
 * True when dsh reports a successful propose_strategy tool result.
 * Used to sync workspace drafts into SQLite mid-turn.
 */
export function isSuccessfulProposeStrategyResult(
  notification: HarnessNotification,
): boolean {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return false;
  if (event.data.error) return false;
  return toolNameFromData(event.data) === "propose_strategy";
}

/**
 * Map a dsh notification into at most one highly abstracted activity step.
 * Grok Bot–style: human verbs only — no turn markers, no args, no result dumps.
 */
export function mapNotificationToActivity(
  agentId: string,
  notification: HarnessNotification,
): NewActivityEvent | null {
  const event = sessionEvent(notification);
  if (!event) return null;
  const { type, data } = event;

  switch (type) {
    case "tool/call": {
      const name = toolNameFromData(data) ?? "tool";
      return {
        agentId,
        kind: "tool_call" satisfies ActivityKind,
        label: activityStepLabel(name),
        detail: null,
        toolName: name,
      };
    }
    case "tool/result": {
      // Successful results stay silent — the call already told the story.
      if (!data.error) return null;
      const name = toolNameFromData(data) ?? "tool";
      return {
        agentId,
        kind: "error" satisfies ActivityKind,
        label: `${activityStepLabel(name)} failed`,
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
      return null;
  }
}
