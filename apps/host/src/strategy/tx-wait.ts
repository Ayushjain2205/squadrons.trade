import { resolveRpcUrl } from "./recipes/rpc.js";

/**
 * Poll until a tx is mined (or timeout). Used between approve and swap.
 */
export async function waitForTxReceipt(input: {
  chainId: number;
  txHash: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<{ ok: true; status: "success" | "reverted" } | { ok: false; reason: string }> {
  const timeoutMs = input.timeoutMs ?? 90_000;
  const pollMs = input.pollMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  let rpcUrl: string;
  try {
    rpcUrl = resolveRpcUrl(input.chainId);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  while (Date.now() < deadline) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionReceipt",
          params: [input.txHash],
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          result?: { status?: string } | null;
          error?: { message?: string };
        };
        if (payload.error?.message) {
          return { ok: false, reason: payload.error.message };
        }
        if (payload.result && typeof payload.result === "object") {
          const statusHex = payload.result.status;
          if (statusHex === "0x1" || statusHex === "0x01") {
            return { ok: true, status: "success" };
          }
          if (statusHex === "0x0" || statusHex === "0x00") {
            return { ok: true, status: "reverted" };
          }
        }
      }
    } catch {
      // keep polling through transient RPC errors
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return {
    ok: false,
    reason: `Timed out waiting for receipt ${input.txHash}`,
  };
}
