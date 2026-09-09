"use client";

import { usePrivy } from "@privy-io/react-auth";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LoginCrew } from "@/components/LoginCrew";
import {
  AuthBootSkeleton,
  DeskBootSkeleton,
} from "@/components/desk/DeskSkeleton";
import {
  clearSquadronsSession,
  hasSquadronsSession,
  markSquadronsSession,
} from "@/lib/session";

function bootCenterForPath(pathname: string | null): "home" | "chat" {
  if (!pathname) return "home";
  // /agents/:id chat — not /agents/new
  if (/^\/agents\/(?!new(?:\/|$))[^/]+/.test(pathname)) return "chat";
  return "home";
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();
  const pathname = usePathname();
  const [knownSession, setKnownSession] = useState<boolean | null>(null);

  useEffect(() => {
    setKnownSession(hasSquadronsSession());
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (authenticated) {
      markSquadronsSession();
      setKnownSession(true);
    } else {
      clearSquadronsSession();
      setKnownSession(false);
    }
  }, [ready, authenticated]);

  if (!ready) {
    if (knownSession === null) {
      return (
        <div
          className="h-dvh bg-[var(--canvas)]"
          aria-busy="true"
          aria-label="Loading Squadrons"
        />
      );
    }
    if (knownSession) {
      return <DeskBootSkeleton center={bootCenterForPath(pathname)} />;
    }
    return <AuthBootSkeleton />;
  }

  if (!authenticated) {
    return (
      <div className="auth-gate relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--canvas)] px-6 text-center">
        <div className="auth-gate-wash pointer-events-none absolute inset-0" />

        <div className="relative z-10 flex max-w-md flex-col items-center gap-7">
          <div className="flex flex-col items-center gap-1">
            <LoginCrew />
            <p className="type-brand text-[length:clamp(3rem,8vw,4rem)] text-[var(--ink)]">
              Squadrons
            </p>
          </div>

          <p className="type-ui max-w-sm text-[var(--ink-soft)]">
            Persistent crypto agents with a shared wallet — sign in to open your
            desk.
          </p>

          <button
            type="button"
            onClick={() => login()}
            className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-7 py-3 font-semibold text-[var(--canvas)] transition hover:opacity-90"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
