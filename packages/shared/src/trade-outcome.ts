/** Marker for structured trade outcome cards in system chat messages. */
export const TRADE_OUTCOME_MARKER_PREFIX = "[[squadrons:trade_outcome:";

export type TradeOutcomeKind = "submitted" | "dry_run" | "failed" | "dismissed";

export type TradeOutcomeCode =
  | "insufficient_gas"
  | "insufficient_funds"
  | "auth"
  | "allowance"
  | "simulation"
  | "policy"
  | "unknown";

export type HumanTradeOutcome = {
  kind: TradeOutcomeKind;
  code: TradeOutcomeCode;
  title: string;
  body: string;
  /** Optional Basescan / explorer hint */
  txHash?: string;
};

export function tradeOutcomeMarker(
  kind: TradeOutcomeKind,
  code: TradeOutcomeCode = "unknown",
): string {
  return `${TRADE_OUTCOME_MARKER_PREFIX}${kind}:${code}]]`;
}

export function parseTradeOutcomeMarker(
  content: string,
): { kind: TradeOutcomeKind; code: TradeOutcomeCode } | null {
  const match = content.match(
    /\[\[squadrons:trade_outcome:(submitted|dry_run|failed|dismissed):([a-z_]+)\]\]/,
  );
  if (!match) return null;
  return {
    kind: match[1] as TradeOutcomeKind,
    code: match[2] as TradeOutcomeCode,
  };
}

export function stripTradeOutcomeMarker(content: string): string {
  return content
    .replace(
      /\[\[squadrons:trade_outcome:(submitted|dry_run|failed|dismissed):[a-z_]+\]\]\s*/g,
      "",
    )
    .trim();
}

/**
 * Map raw executor / Privy errors into copy a trader can act on.
 * Prefer the first matching pattern; keep titles short and recovery concrete.
 */
export function humanizeTradeFailure(reason: string): {
  code: TradeOutcomeCode;
  title: string;
  body: string;
} {
  const text = reason.trim();
  const lower = text.toLowerCase();

  if (
    lower.includes("insufficient funds for gas") ||
    lower.includes("have 0 want") ||
    (lower.includes("insufficient funds") && lower.includes("gas"))
  ) {
    return {
      code: "insufficient_gas",
      title: "Wallet needs ETH for gas",
      body: "Your Base wallet has no ETH to pay the network fee. Send a little ETH to this wallet, then try Approve again.",
    };
  }

  if (
    lower.includes("transfer amount exceeds balance") ||
    lower.includes("exceeds balance") ||
    lower.includes("erc20: transfer amount exceeds") ||
    (lower.includes("insufficient funds") && !lower.includes("gas"))
  ) {
    return {
      code: "insufficient_funds",
      title: "Not enough token balance",
      body: "The wallet doesn’t hold enough of the sell token for this trade size. Lower the size or fund the wallet, then try again.",
    };
  }

  if (
    lower.includes("no valid authorization") ||
    lower.includes("invalid jwt") ||
    (lower.includes("authorization") && lower.includes("401"))
  ) {
    return {
      code: "auth",
      title: "Wallet signing wasn’t authorized",
      body: "Squadrons couldn’t sign with your Privy wallet. Refresh, Approve again, and accept the wallet-access prompt if Privy shows one.",
    };
  }

  if (
    lower.includes("allowance") ||
    lower.includes("approve transaction reverted")
  ) {
    return {
      code: "allowance",
      title: "Token approval didn’t go through",
      body: "The ERC-20 approve step failed on-chain. Check gas and try Approve again.",
    };
  }

  if (lower.includes("tenderly") || lower.includes("simulation")) {
    return {
      code: "simulation",
      title: "Trade simulation failed",
      body: "The dry run on Tenderly rejected this transaction before broadcast. Adjust size or pair and try again.",
    };
  }

  if (
    lower.includes("observe-only") ||
    lower.includes("observe mode") ||
    lower.includes("outside") && lower.includes("policy") ||
    lower.includes("alert-only")
  ) {
    return {
      code: "policy",
      title: "Blocked by spend policy",
      body: text,
    };
  }

  // Strip Privy JSON wrappers when present
  const jsonMatch = text.match(/\{[\s\S]*"error"\s*:\s*"([^"]+)/);
  const cleaned = jsonMatch?.[1] ?? text.replace(/^Privy broadcast failed:\s*/i, "");

  return {
    code: "unknown",
    title: "Trade didn’t complete",
    body: cleaned.length > 220 ? `${cleaned.slice(0, 217)}…` : cleaned,
  };
}

export function formatTradeOutcomeMessage(input: {
  kind: TradeOutcomeKind;
  reason?: string | null;
  detail?: string | null;
  txHash?: string | null;
  approveTxHash?: string | null;
}): { marker: string; content: string; outcome: HumanTradeOutcome } {
  if (input.kind === "submitted") {
    const outcome: HumanTradeOutcome = {
      kind: "submitted",
      code: "unknown",
      title: "Trade submitted",
      body: input.txHash
        ? `Broadcast on Base. Tx ${input.txHash}`
        : "Broadcast on Base.",
      ...(input.txHash ? { txHash: input.txHash } : {}),
    };
    return {
      marker: tradeOutcomeMarker("submitted"),
      content: `${tradeOutcomeMarker("submitted")}\n${outcome.title}\n${outcome.body}`,
      outcome,
    };
  }

  if (input.kind === "dry_run") {
    const outcome: HumanTradeOutcome = {
      kind: "dry_run",
      code: "unknown",
      title: "Paper fill — nothing broadcast",
      body:
        input.detail?.trim() ||
        "Run mode is Paper (or host ceiling blocks Live). No on-chain transaction was sent.",
    };
    return {
      marker: tradeOutcomeMarker("dry_run"),
      content: `${tradeOutcomeMarker("dry_run")}\n${outcome.title}\n${outcome.body}`,
      outcome,
    };
  }

  if (input.kind === "dismissed") {
    const outcome: HumanTradeOutcome = {
      kind: "dismissed",
      code: "unknown",
      title: "Allowance dismissed",
      body: "No token approval or trade was sent.",
    };
    return {
      marker: tradeOutcomeMarker("dismissed"),
      content: `${tradeOutcomeMarker("dismissed")}\n${outcome.title}\n${outcome.body}`,
      outcome,
    };
  }

  const human = humanizeTradeFailure(input.reason ?? input.detail ?? "Unknown error");
  const parts = [human.body];
  if (input.approveTxHash) {
    parts.push(`Approve tx ${input.approveTxHash} may have landed — check Basescan before retrying.`);
  }
  const outcome: HumanTradeOutcome = {
    kind: "failed",
    code: human.code,
    title: human.title,
    body: parts.join(" "),
    ...(input.txHash ? { txHash: input.txHash } : {}),
  };
  return {
    marker: tradeOutcomeMarker("failed", human.code),
    content: `${tradeOutcomeMarker("failed", human.code)}\n${outcome.title}\n${outcome.body}`,
    outcome,
  };
}
