import type { BuiltSwapTx } from "./swap-build.js";

export type TenderlySimResult =
  | { ok: true; detail: string }
  | { ok: false; reason: string };

function tenderlyConfig(): {
  accessKey: string;
  account: string;
  project: string;
} | null {
  const accessKey = process.env.TENDERLY_ACCESS_KEY?.trim();
  const account = process.env.TENDERLY_ACCOUNT_SLUG?.trim();
  const project = process.env.TENDERLY_PROJECT_SLUG?.trim();
  if (!accessKey || !account || !project) return null;
  return { accessKey, account, project };
}

export function isTenderlyConfigured(): boolean {
  return tenderlyConfig() != null;
}

/**
 * Simulate a built swap via Tenderly. Fail-closed when configured keys are present
 * but the simulation errors or reverts.
 */
export async function simulateSwapTx(input: {
  chainId: number;
  from: string;
  tx: BuiltSwapTx;
}): Promise<TenderlySimResult> {
  const cfg = tenderlyConfig();
  if (!cfg) {
    return { ok: false, reason: "Tenderly is not configured" };
  }

  const valueHex = input.tx.value?.startsWith("0x") ? input.tx.value : "0x0";
  const valueDec = BigInt(valueHex).toString(10);

  const url = `https://api.tenderly.co/api/v1/account/${cfg.account}/project/${cfg.project}/simulate`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": cfg.accessKey,
      },
      body: JSON.stringify({
        network_id: String(input.chainId),
        from: input.from,
        to: input.tx.to,
        input: input.tx.data,
        value: valueDec,
        save: false,
        save_if_fails: false,
        simulation_type: "quick",
      }),
    });
  } catch (error) {
    return {
      ok: false,
      reason: `Tenderly network error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload.error === "object" &&
        payload.error &&
        typeof (payload.error as { message?: unknown }).message === "string"
        ? (payload.error as { message: string }).message
        : null) || `HTTP ${response.status}`;
    return { ok: false, reason: `Tenderly simulate failed: ${message}` };
  }

  const simulation = payload?.simulation as
    | { status?: boolean; id?: string }
    | undefined;
  if (simulation?.status !== true) {
    return {
      ok: false,
      reason: "Tenderly simulation reverted",
    };
  }

  return {
    ok: true,
    detail: simulation.id
      ? `Tenderly sim ok (${simulation.id})`
      : "Tenderly sim ok",
  };
}
