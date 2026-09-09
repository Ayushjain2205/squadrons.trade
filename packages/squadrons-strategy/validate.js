function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate propose_strategy args. Mirrors @squadrons/shared parseStrategyDraftInput.
 * @param {unknown} value
 * @returns {{ summary: string, trigger: object, action: object, caps?: object } | null}
 */
export function parseStrategyDraftInput(value) {
  if (!isRecord(value)) return null;
  const summary =
    typeof value.summary === "string" ? value.summary.trim() : "";
  if (!summary) return null;

  if (!isRecord(value.trigger)) return null;
  const triggerType = value.trigger.type;
  if (triggerType !== "interval" && triggerType !== "condition") return null;

  const trigger = { type: triggerType };
  if (value.trigger.intervalSec !== undefined) {
    const intervalSec = Number(value.trigger.intervalSec);
    if (!Number.isFinite(intervalSec) || intervalSec < 15) return null;
    trigger.intervalSec = Math.floor(intervalSec);
  }
  if (value.trigger.condition !== undefined) {
    if (typeof value.trigger.condition !== "string") return null;
    const condition = value.trigger.condition.trim();
    if (condition) trigger.condition = condition;
  }
  if (triggerType === "condition" && !trigger.condition) return null;
  if (triggerType === "interval" && trigger.intervalSec === undefined) {
    trigger.intervalSec = 60;
  }

  if (!isRecord(value.action)) return null;
  const actionType = value.action.type;
  if (actionType !== "alert" && actionType !== "propose_trade") return null;
  const action = { type: actionType };
  if (value.action.detail !== undefined) {
    if (typeof value.action.detail !== "string") return null;
    const detail = value.action.detail.trim();
    if (detail) action.detail = detail;
  }

  let caps;
  if (value.caps !== undefined) {
    if (!isRecord(value.caps)) return null;
    caps = {};
    if (value.caps.maxTradeUsd !== undefined) {
      const maxTradeUsd = Number(value.caps.maxTradeUsd);
      if (!Number.isFinite(maxTradeUsd) || maxTradeUsd <= 0) return null;
      caps.maxTradeUsd = maxTradeUsd;
    }
  }

  return { summary, trigger, action, caps };
}

/**
 * Validate report_tick args. Mirrors @squadrons/shared parseStrategyTickDecision.
 * @param {unknown} value
 * @returns {{ action: "none"|"alert", label: string, detail?: string } | null}
 */
export function parseStrategyTickDecision(value) {
  if (!isRecord(value)) return null;
  const action = value.action;
  if (action !== "none" && action !== "alert") return null;
  const label =
    typeof value.label === "string" && value.label.trim()
      ? value.label.trim()
      : action === "alert"
        ? "Alert"
        : "Checked strategy";
  const detail =
    typeof value.detail === "string" && value.detail.trim()
      ? value.detail.trim()
      : undefined;
  return { action, label, detail };
}
