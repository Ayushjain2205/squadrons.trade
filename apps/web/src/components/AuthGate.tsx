"use client";

import { usePrivy } from "@privy-io/react-auth";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LandingPage } from "@/components/landing/LandingPage";
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
    return <LandingPage onLogin={() => login()} />;
  }

  return <>{children}</>;
}
