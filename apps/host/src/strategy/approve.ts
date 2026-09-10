import { ZEROEX_NATIVE_TOKEN, type BuiltSwap, type BuiltSwapTx } from "./swap-build.js";

const APPROVE_SELECTOR = "095ea7b3"; // approve(address,uint256)
const MAX_UINT256 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

export type BuiltApprove = {
  token: `0x${string}`;
  spender: `0x${string}`;
  amount: string;
  transaction: BuiltSwapTx;
};

export type BuildApproveResult =
  | { ok: true; approve: BuiltApprove }
  | { ok: false; reason: string };

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isNativeToken(address: string): boolean {
  return address.toLowerCase() === ZEROEX_NATIVE_TOKEN.toLowerCase();
}

function encodeApprove(
  spender: `0x${string}`,
  amount: bigint,
): `0x${string}` {
  const spenderWord = spender.slice(2).toLowerCase().padStart(64, "0");
  const amountWord = amount.toString(16).padStart(64, "0");
  return `0x${APPROVE_SELECTOR}${spenderWord}${amountWord}`;
}

/**
 * Build an ERC-20 approve tx for the sell token → 0x allowance target.
 * Uses exact sellAmount when present; otherwise MaxUint256.
 */
export function buildApproveFromSwap(swap: BuiltSwap): BuildApproveResult {
  if (!swap.needsAllowance) {
    return { ok: false, reason: "Swap does not require allowance" };
  }
  if (!isAddress(swap.sellToken) || isNativeToken(swap.sellToken)) {
    return {
      ok: false,
      reason: "Approve only applies to ERC-20 sell tokens",
    };
  }
  if (!isAddress(swap.allowanceTarget)) {
    return { ok: false, reason: "Missing allowance spender from 0x quote" };
  }

  let amount: bigint;
  if (swap.sellAmount && /^\d+$/.test(swap.sellAmount)) {
    amount = BigInt(swap.sellAmount);
  } else {
    amount = MAX_UINT256;
  }
  if (amount <= 0n) {
    return { ok: false, reason: "Approve amount must be positive" };
  }

  return {
    ok: true,
    approve: {
      token: swap.sellToken,
      spender: swap.allowanceTarget,
      amount: amount.toString(10),
      transaction: {
        to: swap.sellToken,
        data: encodeApprove(swap.allowanceTarget, amount),
        value: "0x0",
      },
    },
  };
}
