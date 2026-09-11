import { getPrivyClient } from "../auth/privy.js";
import type { BuiltSwapTx } from "./swap-build.js";

export type BroadcastResult =
  | { ok: true; txHash: string; detail: string }
  | { ok: false; reason: string };

function getAuthorizationPrivateKey(): string | null {
  const raw =
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY?.trim() ||
    process.env.PRIVY_AUTHORIZATION_KEY?.trim() ||
    null;
  if (!raw) return null;
  // Privy dashboard sometimes exports as "wallet-auth:<pkcs8-base64>"
  return raw.startsWith("wallet-auth:") ? raw.slice("wallet-auth:".length) : raw;
}

/** True when an app authorization key is present (server signer). */
export function isPrivyBroadcastConfigured(): boolean {
  return Boolean(getAuthorizationPrivateKey());
}

export function canBroadcast(): boolean {
  return isPrivyBroadcastConfigured();
}

/**
 * Sign + broadcast an EVM tx via Privy Wallet API using the app authorization key.
 * The key must be added as a session signer on the user's embedded wallet first
 * (client `useSigners().addSigners` with the key quorum id).
 */
export async function broadcastEvmTx(input: {
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

/** @deprecated Use {@link broadcastEvmTx} */
export const broadcastSwapTx = broadcastEvmTx;
