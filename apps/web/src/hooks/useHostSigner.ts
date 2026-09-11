"use client";

import { useCallback, useMemo } from "react";
import { usePrivy, useSigners, useWallets } from "@privy-io/react-auth";

export type HostSignerStatus = {
  /** Env has NEXT_PUBLIC_PRIVY_SIGNER_ID */
  configured: boolean;
  /** Embedded wallet address when known */
  address: string | null;
  /** Privy reports this wallet as delegated to a session signer */
  delegated: boolean;
  ready: boolean;
};

function getSignerId(): string | null {
  return process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID?.trim() || null;
}

function pickEmbeddedAddress(
  wallets: { address: string; walletClientType?: string }[],
  userWalletAddress?: string | null,
): string | null {
  const embedded = wallets.find(
    (w) =>
      w.walletClientType === "privy" || w.walletClientType === "privy-v2",
  );
  return embedded?.address ?? userWalletAddress ?? null;
}

function isAddressDelegated(
  user: {
    linkedAccounts?: Array<{
      type: string;
      address?: string;
      delegated?: boolean;
    }>;
  } | null,
  address: string,
): boolean {
  return Boolean(
    user?.linkedAccounts?.some(
      (account) =>
        account.type === "wallet" &&
        account.address?.toLowerCase() === address.toLowerCase() &&
        account.delegated === true,
    ),
  );
}

/**
 * Grant / verify the host authorization key as a Privy session signer
 * on the user's embedded wallet. Idempotent when already delegated.
 */
export function useHostSigner() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { addSigners } = useSigners();

  const signerId = getSignerId();
  const address = useMemo(
    () =>
      pickEmbeddedAddress(
        wallets,
        user?.wallet?.address as string | undefined,
      ),
    [wallets, user?.wallet?.address],
  );

  const delegated = useMemo(
    () => (address ? isAddressDelegated(user, address) : false),
    [user, address],
  );

  const status: HostSignerStatus = {
    configured: Boolean(signerId),
    address,
    delegated,
    ready: ready && authenticated,
  };

  const ensureHostSigner = useCallback(async (): Promise<{
    address: string;
    alreadyDelegated: boolean;
  }> => {
    if (!signerId) {
      throw new Error(
        "NEXT_PUBLIC_PRIVY_SIGNER_ID is not set — cannot grant host wallet access",
      );
    }
    if (!ready || !authenticated) {
      throw new Error("Sign in before enabling host wallet access");
    }

    const walletAddress =
      pickEmbeddedAddress(
        wallets,
        user?.wallet?.address as string | undefined,
      ) ?? null;
    if (!walletAddress) {
      throw new Error(
        "No embedded wallet yet — wait a moment after login, then try again",
      );
    }

    if (isAddressDelegated(user, walletAddress)) {
      return { address: walletAddress, alreadyDelegated: true };
    }

    await addSigners({
      address: walletAddress,
      signers: [{ signerId, policyIds: [] }],
    });

    return { address: walletAddress, alreadyDelegated: false };
  }, [signerId, ready, authenticated, wallets, user, addSigners]);

  return { status, ensureHostSigner };
}
