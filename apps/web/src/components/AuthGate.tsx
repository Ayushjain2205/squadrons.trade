"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--canvas)] text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-[var(--canvas)] px-6 text-center">
        <div className="space-y-2">
          <p className="font-[family-name:var(--font-brand)] text-4xl tracking-tight text-[var(--ink)]">
            Squadrons
          </p>
          <p className="max-w-sm text-sm text-[var(--muted)]">
            Sign in to run your crypto agents with a shared wallet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => login()}
          className="cursor-pointer rounded-full bg-[var(--ink)] px-6 py-2.5 text-sm font-medium text-[var(--canvas)] transition hover:opacity-90"
        >
          Log in
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
