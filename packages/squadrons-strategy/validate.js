function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const RECIPE_IDS = [
  "balance_threshold_alert",
  "price_band_alert",
  "price_cross_alert",
];

function isRecipeId(value) {
  return typeof value === "string" && RECIPE_IDS.includes(value);
}

function parseRecipeParams(recipeId, value) {
  const defaults =
    recipeId === "balance_threshold_alert"
      ? { asset: "native", op: "below", threshold: 0.1 }
      : recipeId === "price_cross_alert"
        ? { symbol: "ETH", level: 3000, direction: "below" }
        : { symbol: "ETH", low: 1000, high: 10000 };
  const raw = value === undefined || value === null ? {} : value;
  if (!isRecord(raw)) return null;

  if (recipeId === "balance_threshold_alert") {
    const asset =
      typeof raw.asset === "string" && raw.asset.trim()
        ? raw.asset.trim()
        : defaults.asset;
    const op = raw.op === "above" || raw.op === "below" ? raw.op : defaults.op;
    const threshold = Number(raw.threshold ?? defaults.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) return null;
    const out = { asset, op, threshold };
    if (typeof raw.walletAddress === "string" && raw.walletAddress.trim()) {
      const addr = raw.walletAddress.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
      out.walletAddress = addr;
    }
    return out;
  }

  if (recipeId === "price_band_alert") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : defaults.symbol;
    const low = Number(raw.low ?? defaults.low);
    const high = Number(raw.high ?? defaults.high);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high <= low) {
      return null;
    }
    return { symbol, low, high };
  }

  if (recipeId === "price_cross_alert") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : defaults.symbol;
    const level = Number(raw.level ?? defaults.level);
    const direction =
      raw.direction === "above" ||
      raw.direction === "below" ||
      raw.direction === "either"
        ? raw.direction
        : defaults.direction;
    if (!Number.isFinite(level) || level < 0) return null;
    return { symbol, level, direction };
  }

  return null;
}

function parseImprovement(value, fallbackKeys) {
  if (!isRecord(value)) {
    return {
      enabled: false,
      cadence: "daily",
      autoApply: false,
      allowedKeys: [...fallbackKeys],
      lastRunAt: null,
    };
  }
  const cadence =
    value.cadence === "hourly" ||
    value.cadence === "daily" ||
    value.cadence === "weekly"
      ? value.cadence
      : "daily";
  const allowedKeys = Array.isArray(value.allowedKeys)
    ? value.allowedKeys.filter((k) => typeof k === "string")
    : fallbackKeys;
  return {
    enabled: value.enabled === true,
    cadence,
    autoApply: false,
    allowedKeys,
    lastRunAt:
      typeof value.lastRunAt === "number" && Number.isFinite(value.lastRunAt)
        ? value.lastRunAt
        : null,
  };
}

/**
 * Validate propose_strategy args. Mirrors @squadrons/shared parseStrategyDraftInput.
 * @param {unknown} value
 */
export function parseStrategyDraftInput(value) {
  if (!isRecord(value)) return null;
  const summary =
    typeof value.summary === "string" ? value.summary.trim() : "";
  if (!summary) return null;
  if (!isRecipeId(value.recipeId)) return null;
  const recipeId = value.recipeId;
  const params = parseRecipeParams(recipeId, value.params);
  if (!params) return null;

  if (!isRecord(value.trigger)) return null;
  const triggerType = value.trigger.type;
  if (triggerType !== "interval" && triggerType !== "event") return null;

  const trigger = { type: triggerType };
  if (value.trigger.intervalSec !== undefined) {
    const intervalSec = Number(value.trigger.intervalSec);
    if (!Number.isFinite(intervalSec) || intervalSec < 15) return null;
    trigger.intervalSec = Math.floor(intervalSec);
  }
  if (value.trigger.event !== undefined) {
    if (typeof value.trigger.event !== "string") return null;
    const event = value.trigger.event.trim();
    if (event) trigger.event = event;
  }
  if (triggerType === "event" && !trigger.event) return null;
  if (triggerType === "interval" && trigger.intervalSec === undefined) {
    trigger.intervalSec = 60;
  }
  if (triggerType === "event" && trigger.intervalSec === undefined) {
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

  const improvement =
    value.improvement === undefined
      ? undefined
      : parseImprovement(value.improvement, Object.keys(params));

  return { summary, recipeId, params, trigger, action, caps, improvement };
}

/**
 * @param {unknown} value
 */
export function parseStrategyParamsPatch(value) {
  if (!isRecord(value)) return null;
  if (!isRecord(value.params)) return null;
  return { params: value.params };
}

/**
 * @param {unknown} value
 */
export function parseProposeImprovementInput(value) {
  if (!isRecord(value)) return null;
  if (!isRecord(value.patch)) return null;
  const patch = { ...value.patch };
  if (Object.keys(patch).length === 0) return null;
  const reason =
    typeof value.reason === "string" && value.reason.trim()
      ? value.reason.trim()
      : undefined;
  return reason ? { patch, reason } : { patch };
}

/**
 * Validate report_tick args. Mirrors @squadrons/shared parseStrategyTickDecision.
 * @param {unknown} value
 */
export function parseStrategyTickDecision(value) {
  if (!isRecord(value)) return null;
  const action = value.action;
  if (action !== "none" && action !== "alert" && action !== "propose_trade") {
    return null;
  }
  const label =
    typeof value.label === "string" && value.label.trim()
      ? value.label.trim()
      : action === "alert"
        ? "Alert"
        : action === "propose_trade"
          ? "Proposed trade"
          : "Checked strategy";
  const detail =
    typeof value.detail === "string" && value.detail.trim()
      ? value.detail.trim()
      : undefined;

  /** @type {{ action: string, label: string, detail?: string, intent?: object }} */
  const out = { action, label };
  if (detail) out.detail = detail;

  if (action === "propose_trade") {
    if (!isRecord(value.intent)) return null;
    const amountUsd = Number(value.intent.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
    /** @type {{ amountUsd: number, symbol?: string, side?: string, note?: string }} */
    const intent = { amountUsd };
    if (typeof value.intent.symbol === "string" && value.intent.symbol.trim()) {
      intent.symbol = value.intent.symbol.trim().toUpperCase();
    }
    if (value.intent.side === "buy" || value.intent.side === "sell") {
      intent.side = value.intent.side;
    }
    if (typeof value.intent.note === "string" && value.intent.note.trim()) {
      intent.note = value.intent.note.trim();
    }
    out.intent = intent;
  }

  return out;
}
