"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAddFunds } from "@privy-io/react-auth";
import { SUPPORTED_CHAINS, getSupportedChain } from "@squadrons/shared";
import { ChainLogo } from "@/components/ChainLogo";
import { WalletIcon } from "@/components/WalletIcon";
import { useHostSigner } from "@/hooks/useHostSigner";
import { getWalletSummary, type WalletChainBalance } from "@/lib/host";
import { useToast } from "@/components/Toast";

/** Base mainnet USDC — destination for Privy add-funds. */
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CAIP2 = "eip155:8453" as const;

function fundingEnvironment(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_PRIVY_FUNDING_ENV === "sandbox"
    ? "sandbox"
    : "production";
}

function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function isFundingCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cancel|exited|closed|abort|dismiss/i.test(message);
}

function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect
        x="9"
        y="9"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function explorerFor(
  chainId: number,
  address: string,
): { label: string; url: string } | null {
  if (chainId === 8453) {
    return { label: "Basescan", url: `https://basescan.org/address/${address}` };
  }
  if (chainId === 1) {
    return {
      label: "Etherscan",
      url: `https://etherscan.io/address/${address}`,
    };
  }
  // Robinhood — no public explorer wired yet
  return null;
}

export function WalletSheet({
  open,
  onClose,
  address,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  address: string | null;
  onLogout: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const { addFunds } = useAddFunds();
  const { status, ensureHostSigner } = useHostSigner();
  const [chains, setChains] = useState<WalletChainBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [signerBusy, setSignerBusy] = useState(false);
  const [fundingBusy, setFundingBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setChains([]);
      return;
    }
    setLoading(true);
    try {
      const summary = await getWalletSummary();
      setChains(summary.chains);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load balances",
      );
    } finally {
      setLoading(false);
    }
  }, [address, toast]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  async function onGrantSigner() {
    setSignerBusy(true);
    try {
      const result = await ensureHostSigner();
      toast.info(
        result.alreadyDelegated
          ? "Host already can sign"
          : "Host can now sign for this wallet",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not grant host access",
      );
    } finally {
      setSignerBusy(false);
    }
  }

  async function onCopy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.info("Address copied");
    } catch {
      toast.error("Could not copy address");
    }
  }

  async function onAddFunds() {
    if (!address) return;
    setFundingBusy(true);
    try {
      const result = await addFunds({
        destination: {
          address,
          chain: BASE_CAIP2,
          asset: BASE_USDC_ADDRESS,
        },
        fiat: {
          source: {
            assets: ["usd", "eur"],
            defaultAsset: "usd",
          },
          environment: fundingEnvironment(),
          defaultAmount: "50",
        },
        crypto: {
          slippageBps: 100,
        },
      });

      if (result.method === "fiat") {
        toast.info(
          result.status === "confirmed"
            ? "Funds confirmed — USDC on Base may take a moment to arrive"
            : "Payment submitted — USDC on Base may take a moment to arrive",
        );
      } else {
        toast.info("Deposit complete — refreshing balances");
      }
      void refresh();
    } catch (err) {
      if (isFundingCancel(err)) return;
      toast.error(
        err instanceof Error ? err.message : "Could not start funding",
      );
    } finally {
      setFundingBusy(false);
    }
  }

  const balanceByChain = new Map(chains.map((row) => [row.chainId, row]));

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-black/40"
        aria-label="Close wallet"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="wallet-sheet absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 shadow-[0_16px_48px_rgb(0_0_0_/_0.55)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-2)] text-[var(--ink-soft)]">
            <WalletIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="type-ui text-[var(--ink)]">
              Wallet
            </h2>
            {address ? (
              <div className="group/addr mt-0.5 flex min-w-0 items-center gap-1">
                <p className="type-data truncate !text-[length:var(--text-ui)] !text-[var(--ink-soft)]">
                  {truncateAddress(address)}
                </p>
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--muted)] opacity-100 transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/addr:opacity-100"
                  aria-label="Copy address"
                  title="Copy address"
                >
                  <CopyIcon />
                </button>
              </div>
            ) : (
              <p className="type-data mt-0.5 truncate !text-[length:var(--text-ui)] !text-[var(--ink-soft)]">
                No wallet yet
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="type-meta cursor-pointer rounded-lg px-2 py-1 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            Esc
          </button>
        </div>

        {address ? (
          <div className="mt-3">
            <button
              type="button"
              disabled={fundingBusy}
              onClick={() => void onAddFunds()}
              className="type-ui w-full cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-40"
            >
              {fundingBusy ? "Opening…" : "Add funds"}
            </button>
            <p className="type-meta mt-1.5 text-center text-[var(--muted)]">
              Buys or deposits land as USDC on Base
            </p>
          </div>
        ) : null}

        <section className="mt-4">
          <h3 className="type-ui text-[var(--ink)]">Host signing</h3>
          <p className="type-meta mt-1 text-[var(--ink-soft)]">
            {status.delegated
              ? "Squadrons can sign when an agent has spend enabled."
              : "Grant once so the host can broadcast after you approve in chat."}
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p
              className={`type-meta ${
                status.delegated
                  ? "!text-[var(--accent)]"
                  : "!text-[var(--muted)]"
              }`}
            >
              {status.delegated ? "Granted" : "Not granted"}
            </p>
            {!status.delegated && status.configured ? (
              <button
                type="button"
                disabled={signerBusy || !address}
                onClick={() => void onGrantSigner()}
                className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-[var(--canvas)] disabled:opacity-40"
              >
                {signerBusy ? "Granting…" : "Grant access"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="type-ui text-[var(--ink)]">Gas by chain</h3>
            <button
              type="button"
              disabled={loading || !address}
              onClick={() => void refresh()}
              className="type-meta cursor-pointer text-[var(--muted)] transition hover:!text-[var(--ink)] disabled:opacity-40"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {SUPPORTED_CHAINS.map((chain) => {
              const row = balanceByChain.get(chain.chainId);
              const balance = row?.balance ?? (loading ? "…" : "—");
              const needsGas = row?.needsGas ?? false;
              const meta = getSupportedChain(chain.chainId);
              const explorer =
                address != null ? explorerFor(chain.chainId, address) : null;
              return (
                <li
                  key={chain.chainId}
                  className="flex items-center gap-2.5 rounded-xl px-1.5 py-2"
                >
                  <ChainLogo chainId={chain.chainId} size={20} />
                  <div className="min-w-0 flex-1">
                    <p className="type-ui text-[var(--ink)]">
                      {meta?.shortName ?? chain.shortName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {needsGas && address ? (
                        <p className="type-meta !text-[var(--warn)]">
                          Needs ETH for gas
                        </p>
                      ) : null}
                      {explorer ? (
                        <a
                          href={explorer.url}
                          target="_blank"
                          rel="noreferrer"
                          className="type-meta !text-[var(--link)] transition hover:opacity-80"
                        >
                          {explorer.label}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <p className="type-data shrink-0 !text-[length:var(--text-ui)] !text-[var(--ink-soft)]">
                    {balance} {row?.symbol ?? "ETH"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-3 border-t border-[var(--line-soft)] pt-2.5">
          <button
            type="button"
            onClick={onLogout}
            className="type-ui w-full cursor-pointer rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
