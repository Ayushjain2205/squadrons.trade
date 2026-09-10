import { getPrivyClient } from "../auth/privy.js";
import type { BuiltSwapTx } from "./swap-build.js";

export type BroadcastResult =
  | { ok: true; txHash: string; detail: string }
  | { ok: false; reason: string };

function getAuthorizationPrivateKey(): string | null {
  return (
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY?.trim() ||
    process.env.PRIVY_AUTHORIZATION_KEY?.trim() ||
    null
  );
}

export function isPrivyBroadcastConfigured(): boolean {
  return Boolean(getAuthorizationPrivateKey());
}

/**
 * Sign + broadcast a built swap via Privy Wallet API.
 * Requires PRIVY_AUTHORIZATION_PRIVATE_KEY (app authorization key) for
 * autonomous server-side sends. Fail-closed when missing.
 */
export async function broadcastSwapTx(input: {
  walletId: string;
  chainId: number;
  tx: BuiltSwapTx;
}): Promise<BroadcastResult> {
  const authKey = getAuthorizationPrivateKey();
  if (!authKey) {
    return {
      ok: false,
      reason:
        "PRIVY_AUTHORIZATION_PRIVATE_KEY is not set — required for live broadcast",
    };
  }

  if (!input.walletId.trim()) {
    return { ok: false, reason: "Missing Privy wallet id" };
  }

  try {
    const privy = getPrivyClient();
    const response = await privy.wallets().ethereum().sendTransaction(
      input.walletId,
      {
        caip2: `eip155:${input.chainId}`,
        params: {
          transaction: {
            to: input.tx.to,
            data: input.tx.data,
            value: input.tx.value,
            chain_id: input.chainId,
            ...(input.tx.gas ? { gas_limit: input.tx.gas } : {}),
          },
        },
        authorization_context: {
          authorization_private_keys: [authKey],
        },
      },
    );

    const txHash = response.hash;
    if (!txHash || typeof txHash !== "string") {
      return { ok: false, reason: "Privy sendTransaction returned no hash" };
    }

    return {
      ok: true,
      txHash,
      detail: `Broadcast ${txHash}`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Privy broadcast failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
