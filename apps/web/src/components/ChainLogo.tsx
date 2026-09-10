"use client";

import { useState } from "react";
import type { SupportedChainId } from "@squadrons/shared";
import { getSupportedChain, SUPPORTED_CHAINS } from "@squadrons/shared";

export function ChainLogo({
  chainId,
  size = 20,
  className = "",
}: {
  chainId: number;
  size?: number;
  className?: string;
}) {
  const chain = getSupportedChain(chainId);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`block shrink-0 overflow-hidden rounded-md bg-[var(--panel-2)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {chain?.logoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- local CoinGecko-sourced PNGs
        <img
          src={chain.logoUrl}
          alt=""
          width={size}
          height={size}
          className="block size-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex size-full items-center justify-center type-meta font-semibold leading-none !text-[var(--ink-soft)]">
          {(chain?.shortName ?? "?").slice(0, 1)}
        </span>
      )}
    </span>
  );
}

function chainDisplayName(chainId: number): string {
  return getSupportedChain(chainId)?.name ?? `Chain ${chainId}`;
}

/** Logo tile — name only on hover/focus. */
export function ChainName({
  chainId,
  size = 18,
  className = "",
  tipPlacement = "top",
}: {
  chainId: number;
  size?: number;
  className?: string;
  /** Prefer `right` near the left edge of a rail so the tip isn’t clipped. */
  tipPlacement?: "top" | "right";
}) {
  const tip = chainDisplayName(chainId);

  return (
    <span
      className={`chain-tip group/chain relative inline-flex leading-none ${className}`}
      tabIndex={0}
      aria-label={tip}
    >
      <ChainLogo chainId={chainId} size={size} />
      <span
        role="tooltip"
        className={`chain-tip-bubble${
          tipPlacement === "right" ? " chain-tip-bubble--right" : ""
        }`}
      >
        {tip}
      </span>
    </span>
  );
}

export function ChainPicker({
  value,
  onChange,
  disabled = false,
  size = 40,
}: {
  value: SupportedChainId;
  onChange: (chainId: SupportedChainId) => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUPPORTED_CHAINS.map((chain) => {
        const selected = chain.chainId === value;
        const tip = chain.name;
        return (
          <button
            key={chain.chainId}
            type="button"
            disabled={disabled}
            onClick={(event) => {
              onChange(chain.chainId);
              event.currentTarget.blur();
            }}
            aria-pressed={selected}
            aria-label={tip}
            className={`chain-tip group/chain relative inline-flex items-center justify-center rounded-lg border p-1.5 leading-none transition ${
              selected
                ? "border-[var(--accent)] bg-[var(--panel)]"
                : "border-[var(--line)] bg-transparent hover:border-[var(--ink-soft)] hover:bg-[var(--panel)]"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <ChainLogo chainId={chain.chainId} size={size} />
            <span role="tooltip" className="chain-tip-bubble">
              {tip}
            </span>
          </button>
        );
      })}
    </div>
  );
}
