"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { LoginCrew } from "@/components/LoginCrew";

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
      <div className="auth-gate relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--canvas)] px-6 text-center">
        <div className="auth-gate-wash pointer-events-none absolute inset-0" />

        <div className="relative z-10 flex max-w-md flex-col items-center gap-7">
          <div className="flex flex-col items-center gap-1">
            <LoginCrew />
            <p className="font-[family-name:var(--font-brand)] text-5xl tracking-wide text-[var(--ink)] sm:text-6xl">
              Squadrons
            </p>
          </div>

          <p className="max-w-sm text-sm leading-relaxed text-[var(--ink-soft)]">
            Persistent crypto agents with a shared wallet — sign in to open your
            desk.
          </p>

          <button
            type="button"
            onClick={() => login()}
            className="cursor-pointer rounded-full bg-[var(--ink)] px-7 py-3 text-sm font-semibold text-[var(--canvas)] transition hover:opacity-90"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
