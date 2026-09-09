import {
  activityStepLabel,
  type ActivityKind,
} from "@squadrons/shared";
import type { NewActivityEvent } from "../agents/activity.js";

export type HarnessNotification = {
  method: string;
  params: Record<string, unknown>;
};

/** Last tool/call name per agent — tool/result error payloads often omit `name`. */
const lastToolCallName = new Map<string, string>();

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
  if (typeof data.name === "string" && data.name.trim()) return data.name;
  const message = data.message as { name?: string } | undefined;
  if (typeof message?.name === "string" && message.name.trim()) {
    return message.name;
  }
  if (typeof data.toolName === "string" && data.toolName.trim()) {
    return data.toolName;
  }
  const tool = data.tool as { name?: string } | undefined;
  if (typeof tool?.name === "string" && tool.name.trim()) return tool.name;
  return null;
}

function errorDetail(data: Record<string, unknown>): string | null {
  const error = data.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
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

/** True when dsh reports a successful report_tick tool result. */
export function isSuccessfulReportTickResult(
  notification: HarnessNotification,
): boolean {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return false;
  if (event.data.error) return false;
  return toolNameFromData(event.data) === "report_tick";
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
      lastToolCallName.set(agentId, name);
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
      const name =
        toolNameFromData(data) ?? lastToolCallName.get(agentId) ?? "tool";
      return {
        agentId,
        kind: "error" satisfies ActivityKind,
        label: `${activityStepLabel(name)} failed`,
        detail: errorDetail(data),
        toolName: name,
      };
    }
    case "turn/end": {
      const reason = data.reason as {
        kind?: string;
        error?: { message?: string };
      } | undefined;
      if (reason?.kind !== "error") return null;
      const message =
        typeof reason.error?.message === "string" && reason.error.message.trim()
          ? reason.error.message.trim()
          : null;
      return {
        agentId,
        kind: "error",
        label: "Something went wrong",
        detail: message,
      };
    }
    default:
      return null;
  }
}
