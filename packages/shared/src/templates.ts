import type { SupportedChainId } from "./policy";
import { isSupportedChainId } from "./policy";
import {
  parseStrategyDraftInput,
  type UpsertStrategyDraftInput,
} from "./strategy";

/**
 * Curated strategy template — a prefilled draft, not a new executor.
 * Import writes a strategy draft; the user still Arms in the desk.
 */
export type StrategyTemplate = {
  id: string;
  name: string;
  /** One-line list subtitle. */
  blurb: string;
  /** Longer body for the template detail pane. */
  description: string;
  /**
   * Home chains this template is offered for.
   * Empty array = any supported chain.
   */
  chainIds: readonly SupportedChainId[];
  tags: readonly string[];
  /** Param keys the desk may tweak before import. */
  editableKeys: readonly string[];
  draft: UpsertStrategyDraftInput;
};

/**
 * Squadrons-authored templates only. Add entries here — no migration.
 * Each draft must use a built-in recipeId.
 */
export const STRATEGY_TEMPLATES: readonly StrategyTemplate[] = [
  {
    id: "eth-dip-alert",
    name: "ETH dip watch",
    blurb: "Alert when ETH crosses below a USD level.",
    description:
      "Event-style watch for ETH USD. The host polls quietly and only fires when price crosses your level — useful for dip alerts without noisy interval spam. Import sets a draft; tweak the level, then Arm.",
    chainIds: [8453, 1],
    tags: ["alert", "price"],
    editableKeys: ["level", "direction"],
    draft: {
      summary: "Alert when ETH crosses below $2,800",
      recipeId: "price_cross_alert",
      params: { symbol: "ETH", level: 2800, direction: "below" },
      trigger: { type: "event", event: "price_cross", intervalSec: 60 },
      action: { type: "alert" },
    },
  },
  {
    id: "eth-price-band",
    name: "ETH price band",
    blurb: "Alert when ETH leaves a USD band.",
    description:
      "Interval check that alerts when ETH spot USD moves outside your low–high band. Good for range monitoring. Defaults are a wide demo band — tighten before Arming.",
    chainIds: [8453, 1],
    tags: ["alert", "price"],
    editableKeys: ["low", "high"],
    draft: {
      summary: "Alert when ETH leaves $2,000–$5,000",
      recipeId: "price_band_alert",
      params: { symbol: "ETH", low: 2000, high: 5000 },
      trigger: { type: "interval", intervalSec: 60 },
      action: { type: "alert" },
    },
  },
  {
    id: "native-low-balance",
    name: "Native balance low",
    blurb: "Alert when home-chain gas/native balance drops below a floor.",
    description:
      "Watches the shared wallet’s native/gas balance on this agent’s home chain. Fires an in-app alert when it drops below your floor so you can top up before txs fail. Works on any supported chain.",
    chainIds: [],
    tags: ["alert", "wallet"],
    editableKeys: ["threshold"],
    draft: {
      summary: "Alert when native balance drops below 0.01",
      recipeId: "balance_threshold_alert",
      params: { asset: "native", op: "below", threshold: 0.01 },
      trigger: { type: "interval", intervalSec: 120 },
      action: { type: "alert" },
    },
  },
  {
    id: "eth-dip-buy",
    name: "ETH dip buy",
    blurb: "Propose a capped ETH buy when price crosses below a level.",
    description:
      "Event-style dip buy on ETH USD. When price crosses your level, the host proposes a capped USDC→ETH swap (spend still fail-closed / desk confirm). Defaults to $10 — tighten level and size before Arming. Needs spend enabled on the agent.",
    chainIds: [8453, 1],
    tags: ["trade", "price", "propose"],
    editableKeys: ["level", "amountUsd", "direction", "side"],
    draft: {
      summary: "Propose buy ETH when price crosses below $2,800 (~$10)",
      recipeId: "price_cross_swap",
      params: {
        symbol: "ETH",
        level: 2800,
        direction: "below",
        side: "buy",
        amountUsd: 10,
      },
      trigger: { type: "event", event: "price_cross", intervalSec: 60 },
      action: { type: "propose_trade" },
      caps: { maxTradeUsd: 10 },
    },
  },
] as const;

export type StrategyTemplateId = (typeof STRATEGY_TEMPLATES)[number]["id"];

export function isStrategyTemplateId(
  value: unknown,
): value is StrategyTemplateId {
  return (
    typeof value === "string" &&
    STRATEGY_TEMPLATES.some((template) => template.id === value)
  );
}

export function getStrategyTemplate(
  id: string,
): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((template) => template.id === id);
}

/** True when the template is offered for this home chain. */
export function templateMatchesChain(
  template: StrategyTemplate,
  chainId: number,
): boolean {
  if (template.chainIds.length === 0) return isSupportedChainId(chainId);
  return template.chainIds.includes(chainId as SupportedChainId);
}

export function listStrategyTemplates(
  chainId?: number,
): StrategyTemplate[] {
  if (chainId === undefined) return [...STRATEGY_TEMPLATES];
  return STRATEGY_TEMPLATES.filter((template) =>
    templateMatchesChain(template, chainId),
  );
}

/**
 * Build a validated strategy draft from a template + optional param overrides.
 * Returns null when the template is missing or overrides fail recipe validation.
 */
export function buildDraftFromTemplate(
  templateId: string,
  paramOverrides?: Record<string, unknown> | null,
): UpsertStrategyDraftInput | null {
  const template = getStrategyTemplate(templateId);
  if (!template) return null;

  const params = {
    ...template.draft.params,
    ...(paramOverrides ?? {}),
  };

  // Keep summary in sync for common editable knobs when the user tweaks them.
  let summary = template.draft.summary;
  if (template.id === "eth-dip-alert" && params.level !== undefined) {
    const level = Number(params.level);
    const direction =
      params.direction === "above"
        ? "above"
        : params.direction === "either"
          ? "either side of"
          : "below";
    if (Number.isFinite(level)) {
      summary = `Alert when ETH crosses ${direction} $${Math.round(level).toLocaleString()}`;
    }
  } else if (template.id === "eth-price-band") {
    const low = Number(params.low);
    const high = Number(params.high);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      summary = `Alert when ETH leaves $${Math.round(low).toLocaleString()}–$${Math.round(high).toLocaleString()}`;
    }
  } else if (template.id === "native-low-balance") {
    const threshold = Number(params.threshold);
    if (Number.isFinite(threshold)) {
      summary = `Alert when native balance drops below ${threshold}`;
    }
  } else if (template.id === "eth-dip-buy") {
    const level = Number(params.level);
    const amountUsd = Number(params.amountUsd);
    const side = params.side === "sell" ? "sell" : "buy";
    const direction =
      params.direction === "above"
        ? "above"
        : params.direction === "either"
          ? "either side of"
          : "below";
    if (Number.isFinite(level)) {
      const size =
        Number.isFinite(amountUsd) && amountUsd > 0
          ? ` (~$${Math.round(amountUsd).toLocaleString()})`
          : "";
      summary = `Propose ${side} ETH when price crosses ${direction} $${Math.round(level).toLocaleString()}${size}`;
    }
  }

  return parseStrategyDraftInput({
    ...template.draft,
    summary,
    params,
  });
}
